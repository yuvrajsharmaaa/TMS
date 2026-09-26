import { AppLogger } from '@/logger/app-logger.service';
import { FileUploadService } from '@/modules/file-upload/file-upload.service';
import { FinanceDocumentsService } from '@/modules/shared/finance-documents/finance-documents.service';
import { TenderInfoSheetsService } from '@/modules/tendering/info-sheets/info-sheets.service';
import { TenderInfosService } from '@/modules/tendering/tenders/tenders.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export type SuggestedRequirementCategory = 'oem' | 'standard' | 'company' | 'other';
export type SuggestedRequirementConfidence = 'high' | 'medium' | 'low';

export interface SuggestedBiddingRequirement {
    documentName: string;
    category: SuggestedRequirementCategory;
    required: boolean;
    source: {
        document: 'main' | 'atc';
        page: number;
        snippet: string;
    };
    matchedLibraryId: string | null;
    confidence: SuggestedRequirementConfidence;
    reasoning: string;
}

export interface BiddingRequirementsAnalysisResult {
    jobId: string;
    requirements: SuggestedBiddingRequirement[];
    llmUsage: Record<string, unknown> | null;
}

interface VolksAiBiddingRequirementsResponse {
    job_id: string;
    requirements: SuggestedBiddingRequirement[];
    llm_usage: Record<string, unknown> | null;
}

/**
 * Bridges document-checklist auto-suggestion to VolksAI's `/analyze-bidding-requirements`
 * endpoint: resolves the tender's main + ATC PDFs (reusing the same resolution logic as
 * PDF field extraction), builds the company document library from `finance_documents`,
 * and forwards both as multipart form data -- mirroring the existing
 * PdfExtractionProcessor -> VolksAI `/extract` integration pattern.
 */
@Injectable()
export class BiddingRequirementsService {
    private readonly logger;

    constructor(
        private readonly appLogger: AppLogger,
        private readonly configService: ConfigService,
        private readonly fileUploadService: FileUploadService,
        private readonly tenderInfosService: TenderInfosService,
        private readonly tenderInfoSheetsService: TenderInfoSheetsService,
        private readonly financeDocumentsService: FinanceDocumentsService,
    ) {
        this.logger = this.appLogger.withContext(BiddingRequirementsService.name);
    }

    async analyzeForTender(tenderId: number): Promise<BiddingRequirementsAnalysisResult> {
        const tender = await this.tenderInfosService.validateExists(tenderId);
        const resolvedDocs = this.tenderInfoSheetsService.resolveTenderDocuments(tender.documents);

        const mainPath = this.resolvePdfPath(resolvedDocs.mainTenderPath);
        if (!fs.existsSync(mainPath)) {
            throw new BadRequestException(
                `Tender main document not found at '${resolvedDocs.mainTenderPath}' (resolved to '${mainPath}')`,
            );
        }

        const libraryDocuments = await this.buildLibraryDocuments();

        const fileBuffer = await fs.promises.readFile(mainPath);
        const formData = new FormData();
        formData.append('pdf_file', new Blob([fileBuffer], { type: 'application/pdf' }), path.basename(mainPath));

        for (const atcPath of resolvedDocs.atcPaths) {
            try {
                const resolvedAtc = this.resolvePdfPath(atcPath);
                if (fs.existsSync(resolvedAtc)) {
                    const atcBuffer = await fs.promises.readFile(resolvedAtc);
                    formData.append('atc_files', new Blob([atcBuffer], { type: 'application/pdf' }), path.basename(resolvedAtc));
                }
            } catch (atcErr) {
                this.logger.warn(`Could not load ATC file '${atcPath}' for tender ${tenderId}: ${(atcErr as Error).message}`);
            }
        }

        formData.append('library_documents', JSON.stringify(libraryDocuments));

        const serviceUrl =
            this.configService.get<string>('volksAi.serviceUrl') ||
            this.configService.get<string>('volksAi.VOLKS_AI_SERVICE_URL') ||
            'http://localhost:8001';
        const timeoutMs =
            this.configService.get<number>('volksAi.timeoutMs') ||
            this.configService.get<number>('volksAi.VOLKS_AI_TIMEOUT_MS') ||
            120000;

        const endpoint = `${serviceUrl.replace(/\/+$/, '')}/analyze-bidding-requirements`;
        this.logger.log(
            `Dispatching bidding-requirements analysis for tender ${tenderId} to ${endpoint} ` +
            `(${resolvedDocs.atcPaths.length} ATC file(s), ${libraryDocuments.length} library doc(s))`,
        );

        let response: Response;
        try {
            response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
                signal: AbortSignal.timeout(timeoutMs),
            });
        } catch (err: unknown) {
            const error = err as Error;
            if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                throw new Error(
                    `Bidding requirements analysis timed out after ${timeoutMs}ms for tender ${tenderId} (URL: ${endpoint})`,
                );
            }
            throw new Error(`Failed to connect to VolksAI service at ${endpoint}: ${error.message}`);
        }

        if (!response.ok) {
            const responseText = await response.text();
            this.logger.error(
                `Bidding requirements analysis failed for tender ${tenderId}: HTTP ${response.status} - ${responseText}`,
            );
            throw new Error(`Bidding requirements analysis failed with HTTP ${response.status} (${response.statusText}): ${responseText}`);
        }

        const result = (await response.json()) as VolksAiBiddingRequirementsResponse;

        this.logger.log(
            `Bidding requirements analysis complete for tender ${tenderId}: ${result.requirements?.length ?? 0} requirement(s) identified`,
        );

        return {
            jobId: result.job_id,
            requirements: result.requirements || [],
            llmUsage: result.llm_usage ?? null,
        };
    }

    private resolvePdfPath(pdfPath: string): string {
        if (path.isAbsolute(pdfPath)) return pdfPath;
        const uploadPath = this.fileUploadService.getAbsolutePath(pdfPath);
        if (fs.existsSync(uploadPath)) return uploadPath;
        return path.resolve(pdfPath);
    }

    /**
     * Pages through the entire finance_documents table (mirrors useFinanceDocumentsAll on
     * the web side) and maps each row into VolksAI's libraryDocuments shape. VolksAI holds
     * no database of its own -- this list is always built here and passed in.
     */
    private async buildLibraryDocuments(): Promise<{ id: string; document_name: string; document_type: string | null }[]> {
        const docs: { id: string; document_name: string; document_type: string | null }[] = [];
        const limit = 100;
        let page = 1;
        let totalPages = 1;

        do {
            const { data, meta } = await this.financeDocumentsService.findAll({ page, limit });
            for (const row of data) {
                docs.push({
                    id: String(row.id),
                    document_name: row.documentName || `Document ${row.id}`,
                    document_type: row.documentType != null ? String(row.documentType) : null,
                });
            }
            totalPages = meta.totalPages || 1;
            page += 1;
        } while (page <= totalPages);

        return docs;
    }
}
