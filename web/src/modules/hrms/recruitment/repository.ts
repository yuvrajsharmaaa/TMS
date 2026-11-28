import { BaseApiService } from "@/services/api/base.service";
import {
     DEFAULT_VACANCY_FUNCTIONS,
    createEmptySearchStrings,
    createEmptyVacancyProgress,
} from "./constants";
import {
    SAMPLE_CANDIDATES,
    SAMPLE_EMPLOYEES,
    SAMPLE_LOCATIONS,
    SAMPLE_REFERRALS,
    SAMPLE_SEARCH_LOGS,
    SAMPLE_TARGET_COMPANIES,
    SAMPLE_VACANCIES,
    SAMPLE_WHATSAPP_TEMPLATES,
} from "./seedData";
import { notify, onCandidateJoined } from "./stubs";
import type {
    Candidate,
    ChangeVacancyStatusPayload,
    CreateCandidateProfilePayload,
    CreateVacancyPayload,
    Referral,
    SaveCallLogPayload,
    SaveClosurePayload,
    SaveInterviewPayload,
    SaveJoiningPayload,
    SaveOfferPayload,
    SaveReferralPayload,
    SaveScreeningPayload,
    SearchLogReference,
    SentMessageLog,
    TargetCompanyReference,
    UpdateVacancyPayload,
    UpdateVacancyProgressPayload,
    Vacancy,
    WhatsAppTemplate,
} from "./types";
import {
    calculateOverallScreeningScore,
    calculateReferralPaymentDueDate,
    createActivityLogEntry,
    deriveCandidateState,
    generateNextCandidateCode,
    generateNextVacancyCode,
    isPositionUniqueAmongOpenRoles,
    todayIsoDate,
} from "./utils";

const STORAGE_KEY = "recruitment:store:v1";

export interface RecruitmentStoreSnapshot {
    vacancies: Vacancy[];
    candidates: Candidate[];
    referrals: Referral[];
    whatsappTemplates: WhatsAppTemplate[];
    customFunctions: string[];
    targetCompanies: TargetCompanyReference[];
    searchLogs: SearchLogReference[];
}

export interface IRecruitmentRepository {
    getSnapshot(): Promise<RecruitmentStoreSnapshot>;
    resetToSampleData(): Promise<RecruitmentStoreSnapshot>;

    // Vacancies
    listVacancies(): Promise<Vacancy[]>;
    createVacancy(payload: CreateVacancyPayload, authorName: string): Promise<Vacancy>;
    updateVacancy(id: string, payload: UpdateVacancyPayload, authorName: string): Promise<Vacancy>;
    changeVacancyStatus(payload: ChangeVacancyStatusPayload, authorName: string): Promise<Vacancy>;
    updateVacancyProgress(
        payload: UpdateVacancyProgressPayload,
        authorName: string
    ): Promise<Vacancy>;
    assignVacancyHr(vacancyId: string, assignedHr: string, authorName: string): Promise<Vacancy>;
    addVacancyNote(vacancyId: string, note: string, authorName: string): Promise<Vacancy>;
    addCustomFunction(functionName: string): Promise<string[]>;

    // Candidates
    listCandidates(): Promise<Candidate[]>;
    createCandidate(payload: CreateCandidateProfilePayload, authorName: string): Promise<Candidate>;
    updateCandidateProfile(
        id: string,
        payload: Partial<CreateCandidateProfilePayload>,
        authorName: string
    ): Promise<Candidate>;
    saveScreening(payload: SaveScreeningPayload, authorName: string): Promise<Candidate>;
    saveCallLog(payload: SaveCallLogPayload, authorName: string): Promise<Candidate>;
    rescheduleCallBack(
        candidateId: string,
        callbackDate: string,
        callbackTime: string,
        reason: string,
        authorName: string
    ): Promise<Candidate>;
    saveInterview(payload: SaveInterviewPayload, authorName: string): Promise<Candidate>;
    saveOffer(payload: SaveOfferPayload, authorName: string): Promise<Candidate>;
    saveJoining(payload: SaveJoiningPayload, authorName: string): Promise<Candidate>;
    saveClosure(payload: SaveClosurePayload, authorName: string): Promise<Candidate>;
    reopenCandidate(candidateId: string, reason: string, authorName: string): Promise<Candidate>;
    logWhatsAppMessage(
        candidateId: string,
        templateTitle: string,
        recipient: string,
        body: string,
        authorName: string
    ): Promise<Candidate>;
    addCandidateNote(candidateId: string, note: string, authorName: string): Promise<Candidate>;

    // Referrals
    listReferrals(): Promise<Referral[]>;
    updateReferral(payload: SaveReferralPayload, authorName: string): Promise<Referral>;

    // Templates & Reference
    listWhatsAppTemplates(): Promise<WhatsAppTemplate[]>;
}

function createInitialSnapshot(): RecruitmentStoreSnapshot {
    return {
        vacancies: structuredClone(SAMPLE_VACANCIES),
        candidates: structuredClone(SAMPLE_CANDIDATES),
        referrals: structuredClone(SAMPLE_REFERRALS),
        whatsappTemplates: structuredClone(SAMPLE_WHATSAPP_TEMPLATES),
        customFunctions: [...DEFAULT_VACANCY_FUNCTIONS],
        targetCompanies: structuredClone(SAMPLE_TARGET_COMPANIES),
        searchLogs: structuredClone(SAMPLE_SEARCH_LOGS),
    };
}

export class InMemoryRecruitmentRepository implements IRecruitmentRepository {
    private state: RecruitmentStoreSnapshot;

    constructor() {
        this.state = this.loadFromStorage();
    }

    private loadFromStorage(): RecruitmentStoreSnapshot {
        try {
            if (typeof window !== "undefined") {
                const raw = window.localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw) as RecruitmentStoreSnapshot;
                    if (
                        parsed &&
                        Array.isArray(parsed.vacancies) &&
                        Array.isArray(parsed.candidates)
                    ) {
                        return parsed;
                    }
                }
            }
        } catch {
            // Fallback to initial seed snapshot
        }
        const initial = createInitialSnapshot();
        this.saveToStorage(initial);
        return initial;
    }

    private saveToStorage(next: RecruitmentStoreSnapshot = this.state): void {
        try {
            if (typeof window !== "undefined") {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            }
        } catch {
            // Ignore quota errors
        }
    }

    private syncCandidateDerivedStatus(candidate: Candidate): void {
        const latestCall = candidate.callLogs[candidate.callLogs.length - 1];
        const hrInt = candidate.interviews.find(i => i.round === "HR");
        const techInt = candidate.interviews.find(i => i.round === "Technical");
        const dirInt = candidate.interviews.find(i => i.round === "Director");

        const derived = deriveCandidateState({
            screeningDecision: candidate.screening?.decision ?? null,
            latestCallOutcome: latestCall?.outcome ?? null,
            hrRecommendation: hrInt?.hrRecommendation ?? null,
            technicalRecommendation: techInt?.technicalRecommendation ?? null,
            directorDecision: dirInt?.directorDecision ?? null,
            hasTechnicalInterviewScheduled: Boolean(techInt),
            hasDirectorInterviewScheduled: Boolean(dirInt),
            offerReleased: Boolean(candidate.offer),
            offerResponse: candidate.offer?.candidateResponse ?? null,
            joiningStatus: candidate.joining?.joiningStatus ?? null,
            closureStatus: candidate.closure?.finalStatus ?? null,
        });

        candidate.currentStatus = derived.currentStatus;
        candidate.stageBucket = derived.stageBucket;
        candidate.nextAction = derived.nextAction;
        candidate.isClosed = derived.isClosed;
    }

    async getSnapshot(): Promise<RecruitmentStoreSnapshot> {
        return structuredClone(this.state);
    }

    async resetToSampleData(): Promise<RecruitmentStoreSnapshot> {
        this.state = createInitialSnapshot();
        this.saveToStorage();
        return structuredClone(this.state);
    }

    async listVacancies(): Promise<Vacancy[]> {
        return structuredClone(this.state.vacancies);
    }

    async createVacancy(payload: CreateVacancyPayload, authorName: string): Promise<Vacancy> {
        if (!payload.position.trim()) {
            throw new Error("Position title is required.");
        }
        if (!isPositionUniqueAmongOpenRoles(payload.position, this.state.vacancies)) {
            throw new Error(
                `An open vacancy for "${payload.position.trim()}" already exists. Position title must be unique among open roles.`
            );
        }
        if (payload.totalVacancies < 1 || !Number.isInteger(payload.totalVacancies)) {
            throw new Error("Total Vacancies must be a whole number of 1 or more.");
        }
        if (
            payload.salaryMin !== null &&
            payload.salaryMax !== null &&
            payload.salaryMax < payload.salaryMin
        ) {
            throw new Error("Maximum salary must be greater than or equal to Minimum salary.");
        }

        const vacancyCode = generateNextVacancyCode(
            this.state.vacancies.map(v => v.vacancyCode)
        );
        const now = new Date().toISOString();
        const id = `vac-${Date.now()}`;

        const firstLogNote = payload.initialRemarks?.trim()
            ? payload.initialRemarks.trim()
            : `Vacancy ${vacancyCode} (${payload.position.trim()}) created with ${payload.totalVacancies} seat(s).`;

        const progress = createEmptyVacancyProgress();
        if (payload.jdStatus === "Finalized") {
            progress.jd = { status: "Done", note: "JD Finalized on creation" };
        } else if (payload.jdStatus === "In Progress") {
            progress.jd = { status: "In Progress", note: "JD in progress" };
        }

        const newVacancy: Vacancy = {
            id,
            vacancyCode,
            position: payload.position.trim(),
            functionName: payload.functionName,
            location: payload.location || null,
            startDate: payload.startDate || todayIsoDate(),
            totalVacancies: payload.totalVacancies,
            remainingVacancies: payload.totalVacancies,
            reportingTo: payload.reportingTo,
            salaryMin: payload.salaryMin,
            salaryMax: payload.salaryMax,
            salaryPeriod: payload.salaryPeriod,
            status: payload.status || "Active",
            jdStatus: payload.jdStatus || "Not Started",
            jdFileName: payload.jdFileName || null,
            assignedHr: payload.assignedHr || null,
            initialRemarks: payload.initialRemarks || null,
            progress,
            searchStrings: createEmptySearchStrings(),
            activityLog: [createActivityLogEntry("vacancy", id, authorName, firstLogNote, now)],
            isSample: false,
            createdAt: now,
            updatedAt: now,
        };

        if (
            payload.functionName &&
            !this.state.customFunctions.includes(payload.functionName)
        ) {
            this.state.customFunctions.push(payload.functionName);
        }

        this.state.vacancies.unshift(newVacancy);
        this.saveToStorage();
        return structuredClone(newVacancy);
    }

    async updateVacancy(
        id: string,
        payload: UpdateVacancyPayload,
        authorName: string
    ): Promise<Vacancy> {
        const vacancy = this.state.vacancies.find(v => v.id === id);
        if (!vacancy) throw new Error("Vacancy not found.");

        if (
            payload.position &&
            !isPositionUniqueAmongOpenRoles(payload.position, this.state.vacancies, id)
        ) {
            throw new Error(
                `An open vacancy for "${payload.position.trim()}" already exists. Position must be unique among open roles.`
            );
        }

        const nextMin =
            payload.salaryMin !== undefined ? payload.salaryMin : vacancy.salaryMin;
        const nextMax =
            payload.salaryMax !== undefined ? payload.salaryMax : vacancy.salaryMax;
        if (nextMin !== null && nextMax !== null && nextMax < nextMin) {
            throw new Error("Maximum salary must be greater than or equal to Minimum salary.");
        }

        if (payload.totalVacancies !== undefined) {
            const filledSeats = Math.max(
                0,
                vacancy.totalVacancies - vacancy.remainingVacancies
            );
            vacancy.totalVacancies = payload.totalVacancies;
            vacancy.remainingVacancies = Math.max(0, payload.totalVacancies - filledSeats);
        }

        if (payload.position !== undefined) vacancy.position = payload.position.trim();
        if (payload.functionName !== undefined) {
            vacancy.functionName = payload.functionName;
            if (!this.state.customFunctions.includes(payload.functionName)) {
                this.state.customFunctions.push(payload.functionName);
            }
        }
        if (payload.location !== undefined) vacancy.location = payload.location;
        if (payload.startDate !== undefined) vacancy.startDate = payload.startDate;
        if (payload.reportingTo !== undefined) vacancy.reportingTo = payload.reportingTo;
        if (payload.salaryMin !== undefined) vacancy.salaryMin = payload.salaryMin;
        if (payload.salaryMax !== undefined) vacancy.salaryMax = payload.salaryMax;
        if (payload.salaryPeriod !== undefined) vacancy.salaryPeriod = payload.salaryPeriod;
        if (payload.status !== undefined) vacancy.status = payload.status;
        if (payload.jdStatus !== undefined) vacancy.jdStatus = payload.jdStatus;
        if (payload.jdFileName !== undefined) vacancy.jdFileName = payload.jdFileName;
        if (payload.assignedHr !== undefined) vacancy.assignedHr = payload.assignedHr;

        // Keep candidate appliedRole synced if position changed
        for (const c of this.state.candidates) {
            if (c.vacancyId === vacancy.id) {
                c.appliedRole = vacancy.position;
            }
        }

        vacancy.updatedAt = new Date().toISOString();
        vacancy.activityLog.unshift(
            createActivityLogEntry(
                "vacancy",
                vacancy.id,
                authorName,
                `Vacancy details updated (JD: ${vacancy.jdStatus}, Seats: ${vacancy.totalVacancies - vacancy.remainingVacancies}/${vacancy.totalVacancies}).`
            )
        );

        this.saveToStorage();
        return structuredClone(vacancy);
    }

    async changeVacancyStatus(
        payload: ChangeVacancyStatusPayload,
        authorName: string
    ): Promise<Vacancy> {
        const vacancy = this.state.vacancies.find(v => v.id === payload.vacancyId);
        if (!vacancy) throw new Error("Vacancy not found.");

        if (!payload.reason || !payload.reason.trim()) {
            throw new Error("A reason is required when changing vacancy status.");
        }

        if (
            payload.newStatus === "Filled" &&
            vacancy.remainingVacancies > 0 &&
            (!payload.overrideFilledReason || !payload.overrideFilledReason.trim())
        ) {
            throw new Error(
                `Vacancy still has ${vacancy.remainingVacancies} remaining seat(s). An override reason is required to mark it Filled.`
            );
        }

        const prevStatus = vacancy.status;
        vacancy.status = payload.newStatus;
        vacancy.statusReason = payload.reason.trim();
        vacancy.statusEffectiveDate = payload.effectiveDate || todayIsoDate();
        if (payload.overrideFilledReason?.trim()) {
            vacancy.overrideFilledReason = payload.overrideFilledReason.trim();
        }
        vacancy.updatedAt = new Date().toISOString();

        const overrideNote =
            payload.newStatus === "Filled" && payload.overrideFilledReason?.trim()
                ? ` (Override: ${payload.overrideFilledReason.trim()})`
                : "";

        vacancy.activityLog.unshift(
            createActivityLogEntry(
                "vacancy",
                vacancy.id,
                authorName,
                `Status changed from ${prevStatus} to ${payload.newStatus} (Effective: ${vacancy.statusEffectiveDate}). Reason: ${payload.reason.trim()}${overrideNote}`
            )
        );

        if (payload.newStatus === "On Hold") {
            const shortlisted = this.state.candidates.filter(
                c =>
                    c.vacancyId === vacancy.id &&
                    !c.isClosed &&
                    (c.stageBucket === "HR Shortlisted" ||
                        c.stageBucket === "With Team Leader" ||
                        c.stageBucket === "With Director" ||
                        c.stageBucket === "Selected")
            );
            notify("VACANCY_ON_HOLD", {
                vacancyCode: vacancy.vacancyCode,
                position: vacancy.position,
                reason: payload.reason.trim(),
                shortlistedCandidates: shortlisted.map(c => ({
                    code: c.candidateCode,
                    name: c.candidateName,
                    contactNo: c.contactNo,
                })),
            });
        }

        if (payload.newStatus === "Filled") {
            // Move non-closed pipeline candidates to Closed (Position Closed) in Filled Archive
            for (const c of this.state.candidates) {
                if (c.vacancyId === vacancy.id && !c.isClosed) {
                    c.isClosed = true;
                    c.currentStatus = "Position Closed";
                    c.stageBucket = "Closed";
                    c.nextAction = "Archived (Vacancy Filled)";
                    c.closure = {
                        finalStatus: "Position Closed",
                        closureDate: payload.effectiveDate || todayIsoDate(),
                        closedBy: authorName,
                        closingRemarks: `Vacancy ${vacancy.vacancyCode} marked Filled: ${payload.reason.trim()}`,
                    };
                    c.activityLog.unshift(
                        createActivityLogEntry(
                            "candidate",
                            c.id,
                            authorName,
                            `Moved to Filled Archive as vacancy ${vacancy.vacancyCode} was marked Filled.`
                        )
                    );
                }
            }
        }

        this.saveToStorage();
        return structuredClone(vacancy);
    }

    async updateVacancyProgress(
        payload: UpdateVacancyProgressPayload,
        authorName: string
    ): Promise<Vacancy> {
        const vacancy = this.state.vacancies.find(v => v.id === payload.vacancyId);
        if (!vacancy) throw new Error("Vacancy not found.");

        vacancy.progress = structuredClone(payload.progress);
        vacancy.searchStrings = structuredClone(payload.searchStrings);

        if (payload.progress.jd.status === "Done") {
            vacancy.jdStatus = "Finalized";
        } else if (payload.progress.jd.status === "In Progress") {
            vacancy.jdStatus = "In Progress";
        }

        if (payload.searchStrings.booleanQuery.trim()) {
            const existingIdx = this.state.searchLogs.findIndex(
                s =>
                    s.vacancyCode === vacancy.vacancyCode &&
                    s.booleanString === payload.searchStrings.booleanQuery.trim()
            );
            if (existingIdx === -1) {
                this.state.searchLogs.unshift({
                    id: `slog-${Date.now()}`,
                    loggedDate: todayIsoDate(),
                    vacancyCode: vacancy.vacancyCode,
                    position: vacancy.position,
                    portal: "Naukri Resdex",
                    booleanString: payload.searchStrings.booleanQuery.trim(),
                    profilesFound: 25,
                    loggedBy: authorName,
                });
            }
        }

        vacancy.updatedAt = new Date().toISOString();
        vacancy.activityLog.unshift(
            createActivityLogEntry(
                "vacancy",
                vacancy.id,
                authorName,
                "Updated Role Progress checklist and Resdex search strings."
            )
        );

        this.saveToStorage();
        return structuredClone(vacancy);
    }

    async assignVacancyHr(
        vacancyId: string,
        assignedHr: string,
        authorName: string
    ): Promise<Vacancy> {
        const vacancy = this.state.vacancies.find(v => v.id === vacancyId);
        if (!vacancy) throw new Error("Vacancy not found.");

        vacancy.assignedHr = assignedHr;
        vacancy.updatedAt = new Date().toISOString();
        vacancy.activityLog.unshift(
            createActivityLogEntry(
                "vacancy",
                vacancy.id,
                authorName,
                `Assigned HR updated to ${assignedHr}.`
            )
        );

        this.saveToStorage();
        return structuredClone(vacancy);
    }

    async addVacancyNote(
        vacancyId: string,
        note: string,
        authorName: string
    ): Promise<Vacancy> {
        const vacancy = this.state.vacancies.find(v => v.id === vacancyId);
        if (!vacancy) throw new Error("Vacancy not found.");
        if (!note.trim()) return structuredClone(vacancy);

        vacancy.activityLog.unshift(
            createActivityLogEntry("vacancy", vacancy.id, authorName, note.trim())
        );
        vacancy.updatedAt = new Date().toISOString();
        this.saveToStorage();
        return structuredClone(vacancy);
    }

    async addCustomFunction(functionName: string): Promise<string[]> {
        const trimmed = functionName.trim();
        if (trimmed && !this.state.customFunctions.includes(trimmed)) {
            this.state.customFunctions.push(trimmed);
            this.saveToStorage();
        }
        return [...this.state.customFunctions];
    }

    async listCandidates(): Promise<Candidate[]> {
        return structuredClone(this.state.candidates);
    }

    async createCandidate(
        payload: CreateCandidateProfilePayload,
        authorName: string
    ): Promise<Candidate> {
        const vacancy = this.state.vacancies.find(v => v.id === payload.vacancyId);
        if (!vacancy) {
            throw new Error("Please select a valid Role (Vacancy).");
        }
        if (vacancy.status !== "Active" || vacancy.jdStatus !== "Finalized") {
            throw new Error(
                "Only Active vacancies with a Finalized JD can accept new candidates."
            );
        }
        if (!payload.candidateName.trim()) {
            throw new Error("Candidate Name is required.");
        }
        if (!payload.contactNo.trim()) {
            throw new Error("Contact No. is required.");
        }
        if (!payload.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) {
            throw new Error("A valid Email address is required.");
        }
        if (
            payload.source === "Employee Referral" &&
            (!payload.referrer || !payload.referrer.trim() || payload.referrer === "N.A.")
        ) {
            throw new Error("Referrer is required when Source is Employee Referral.");
        }

        const candidateCode = generateNextCandidateCode(
            this.state.candidates.map(c => c.candidateCode)
        );
        const now = new Date().toISOString();
        const id = `cand-${Date.now()}`;
        const referrerValue =
            payload.source === "Employee Referral" ? payload.referrer.trim() : "N.A.";

        const firstNote = payload.initialNote?.trim()
            ? payload.initialNote.trim()
            : `Candidate ${candidateCode} (${payload.candidateName.trim()}) enrolled for ${vacancy.position} via ${payload.source}.`;

        const newCandidate: Candidate = {
            id,
            candidateCode,
            vacancyId: vacancy.id,
            appliedRole: vacancy.position,
            source: payload.source,
            referrer: referrerValue,
            startDate: payload.startDate || todayIsoDate(),
            candidateName: payload.candidateName.trim(),
            contactNo: payload.contactNo.trim(),
            email: payload.email.trim(),
            employer: payload.employer.trim(),
            designation: payload.designation.trim(),
            companyTurnover: payload.companyTurnover || null,
            annualSalary: payload.annualSalary,
            experience: Number(payload.experience) || 0,
            education: payload.education || null,
            currentLocation: payload.currentLocation,
            preferredLocation: payload.preferredLocation,
            cvFileName: payload.cvFileName || null,
            autoFilledFields: payload.autoFilledFields || [],
            initialNote: payload.initialNote || null,
            assignedHr: payload.assignedHr || vacancy.assignedHr || authorName || "Priya Nair (HR)",
            currentStatus: "Pruning Cleared",
            stageBucket: "Pruning",
            nextAction: "Score Profile (Step 2)",
            isClosed: false,
            screening: null,
            callLogs: [],
            interviews: [],
            offer: null,
            joining: null,
            closure: null,
            messagesSent: [],
            activityLog: [createActivityLogEntry("candidate", id, authorName, firstNote, now)],
            isSample: false,
            createdAt: now,
            updatedAt: now,
        };

        this.state.candidates.unshift(newCandidate);

        // If Employee Referral, automatically add to Referrals tab (Section 6 Step 1)
        if (payload.source === "Employee Referral") {
            const newReferral: Referral = {
                id: `ref-${Date.now()}`,
                candidateId: newCandidate.id,
                candidateCode: newCandidate.candidateCode,
                candidateName: newCandidate.candidateName,
                appliedRole: newCandidate.appliedRole,
                referrer: referrerValue,
                referralAmount: null,
                joiningDate: null,
                paymentDueDate: null,
                paymentStatus: "Pending",
                paymentDate: null,
                remarks: `Enrolled via Employee Referral by ${referrerValue}.`,
                isSample: false,
                updatedAt: now,
            };
            this.state.referrals.unshift(newReferral);
        }

        vacancy.activityLog.unshift(
            createActivityLogEntry(
                "vacancy",
                vacancy.id,
                authorName,
                `New candidate ${newCandidate.candidateCode} (${newCandidate.candidateName}) added via ${newCandidate.source}.`
            )
        );

        this.saveToStorage();
        return structuredClone(newCandidate);
    }

    async updateCandidateProfile(
        id: string,
        payload: Partial<CreateCandidateProfilePayload>,
        authorName: string
    ): Promise<Candidate> {
        const candidate = this.state.candidates.find(c => c.id === id);
        if (!candidate) throw new Error("Candidate not found.");
        if (candidate.isClosed) {
            throw new Error("Closed candidates are read-only unless reopened by HR.");
        }

        if (payload.vacancyId && payload.vacancyId !== candidate.vacancyId) {
            const vac = this.state.vacancies.find(v => v.id === payload.vacancyId);
            if (vac) {
                candidate.vacancyId = vac.id;
                candidate.appliedRole = vac.position;
            }
        }
        if (payload.source !== undefined) {
            candidate.source = payload.source;
            candidate.referrer =
                payload.source === "Employee Referral"
                    ? payload.referrer?.trim() || candidate.referrer
                    : "N.A.";
        }
        if (payload.candidateName !== undefined)
            candidate.candidateName = payload.candidateName.trim();
        if (payload.contactNo !== undefined) candidate.contactNo = payload.contactNo.trim();
        if (payload.email !== undefined) candidate.email = payload.email.trim();
        if (payload.employer !== undefined) candidate.employer = payload.employer.trim();
        if (payload.designation !== undefined) candidate.designation = payload.designation.trim();
        if (payload.companyTurnover !== undefined)
            candidate.companyTurnover = payload.companyTurnover;
        if (payload.annualSalary !== undefined) candidate.annualSalary = payload.annualSalary;
        if (payload.experience !== undefined) candidate.experience = Number(payload.experience) || 0;
        if (payload.education !== undefined) candidate.education = payload.education;
        if (payload.currentLocation !== undefined)
            candidate.currentLocation = payload.currentLocation;
        if (payload.preferredLocation !== undefined)
            candidate.preferredLocation = payload.preferredLocation;
        if (payload.cvFileName !== undefined) candidate.cvFileName = payload.cvFileName;
        if (payload.assignedHr !== undefined) candidate.assignedHr = payload.assignedHr;

        // Sync referral record if Employee Referral
        if (candidate.source === "Employee Referral") {
            const existingRef = this.state.referrals.find(r => r.candidateId === candidate.id);
            if (existingRef) {
                existingRef.candidateName = candidate.candidateName;
                existingRef.appliedRole = candidate.appliedRole;
                existingRef.referrer = candidate.referrer;
                existingRef.updatedAt = new Date().toISOString();
            } else {
                this.state.referrals.unshift({
                    id: `ref-${Date.now()}`,
                    candidateId: candidate.id,
                    candidateCode: candidate.candidateCode,
                    candidateName: candidate.candidateName,
                    appliedRole: candidate.appliedRole,
                    referrer: candidate.referrer,
                    referralAmount: null,
                    joiningDate: null,
                    paymentDueDate: null,
                    paymentStatus: "Pending",
                    paymentDate: null,
                    remarks: `Converted to Employee Referral (${candidate.referrer}).`,
                    isSample: false,
                    updatedAt: new Date().toISOString(),
                });
            }
        }

        candidate.updatedAt = new Date().toISOString();
        candidate.activityLog.unshift(
            createActivityLogEntry("candidate", candidate.id, authorName, "Candidate profile updated.")
        );

        this.saveToStorage();
        return structuredClone(candidate);
    }

    async saveScreening(
        payload: SaveScreeningPayload,
        authorName: string
    ): Promise<Candidate> {
        const candidate = this.state.candidates.find(c => c.id === payload.candidateId);
        if (!candidate) throw new Error("Candidate not found.");

        if (
            payload.decision === "Pruning Rejected" &&
            (!payload.rejectionReason || !payload.rejectionReason.trim()) &&
            (!payload.remarks || !payload.remarks.trim())
        ) {
            throw new Error("A rejection reason is mandatory when decision is Pruning Rejected.");
        }

        const overallScore = calculateOverallScreeningScore(
            payload.primaryRelevance,
            payload.secondaryRelevance
        );
        const now = new Date().toISOString();

        candidate.screening = {
            primaryRelevance: payload.primaryRelevance,
            secondaryRelevance: payload.secondaryRelevance,
            overallScore,
            decision: payload.decision,
            remarks: payload.remarks.trim(),
            rejectionReason:
                payload.decision === "Pruning Rejected"
                    ? (payload.rejectionReason || payload.remarks).trim()
                    : null,
            updatedAt: now,
            updatedBy: authorName,
        };

        if (payload.decision === "Pruning Rejected") {
            candidate.closure = {
                finalStatus: "Rejected",
                closureDate: todayIsoDate(),
                closedBy: authorName,
                closingRemarks: `Pruning Rejected: ${(payload.rejectionReason || payload.remarks).trim()}`,
            };
        }

        this.syncCandidateDerivedStatus(candidate);
        candidate.updatedAt = now;
        candidate.activityLog.unshift(
            createActivityLogEntry(
                "candidate",
                candidate.id,
                authorName,
                `Step 2 Screening saved: ${payload.decision} (Overall Score: ${overallScore}/5). ${payload.remarks.trim()}`
            )
        );

        this.saveToStorage();
        return structuredClone(candidate);
    }

    async saveCallLog(payload: SaveCallLogPayload, authorName: string): Promise<Candidate> {
        const candidate = this.state.candidates.find(c => c.id === payload.candidateId);
        if (!candidate) throw new Error("Candidate not found.");

        if (payload.outcome === "Call Back" && !payload.callbackDate) {
            throw new Error("Callback Date is required when outcome is Call Back.");
        }

        const now = new Date().toISOString();
        candidate.callLogs.push({
            id: `call-${Date.now()}`,
            candidateId: candidate.id,
            callDate: payload.callDate || todayIsoDate(),
            callTime: payload.callTime || "10:00",
            outcome: payload.outcome,
            remarks: payload.remarks.trim(),
            callbackDate: payload.outcome === "Call Back" ? payload.callbackDate : null,
            callbackTime: payload.outcome === "Call Back" ? payload.callbackTime || "11:00" : null,
            currentSalary: payload.outcome === "Interested" ? payload.currentSalary : null,
            expectedSalary: payload.outcome === "Interested" ? payload.expectedSalary : null,
            noticePeriod: payload.outcome === "Interested" ? payload.noticePeriod : null,
            reasonForChange: payload.outcome === "Interested" ? payload.reasonForChange : null,
            loggedBy: authorName,
            createdAt: now,
        });

        if (payload.outcome === "Not Interested") {
            candidate.closure = {
                finalStatus: "Rejected",
                closureDate: todayIsoDate(),
                closedBy: authorName,
                closingRemarks: `Not Interested on Screening Call: ${payload.remarks.trim() || "Closed"}`,
            };
        }

        this.syncCandidateDerivedStatus(candidate);
        candidate.updatedAt = now;
        candidate.activityLog.unshift(
            createActivityLogEntry(
                "candidate",
                candidate.id,
                authorName,
                `Step 3 Screening Call logged: ${payload.outcome}${
                    payload.outcome === "Call Back" && payload.callbackDate
                        ? ` (Callback: ${payload.callbackDate} ${payload.callbackTime || ""})`
                        : ""
                }. ${payload.remarks.trim()}`
            )
        );

        this.saveToStorage();
        return structuredClone(candidate);
    }

    async rescheduleCallBack(
        candidateId: string,
        callbackDate: string,
        callbackTime: string,
        reason: string,
        authorName: string
    ): Promise<Candidate> {
        const candidate = this.state.candidates.find(c => c.id === candidateId);
        if (!candidate) throw new Error("Candidate not found.");

        const latestCall = candidate.callLogs[candidate.callLogs.length - 1];
        if (latestCall) {
            latestCall.outcome = "Call Back";
            latestCall.callbackDate = callbackDate;
            latestCall.callbackTime = callbackTime;
            latestCall.remarks = `${latestCall.remarks} | Rescheduled: ${reason}`.trim();
        } else {
            candidate.callLogs.push({
                id: `call-${Date.now()}`,
                candidateId: candidate.id,
                callDate: todayIsoDate(),
                callTime: "10:00",
                outcome: "Call Back",
                remarks: `Callback scheduled: ${reason}`,
                callbackDate,
                callbackTime,
                loggedBy: authorName,
                createdAt: new Date().toISOString(),
            });
        }

        this.syncCandidateDerivedStatus(candidate);
        candidate.updatedAt = new Date().toISOString();
        candidate.activityLog.unshift(
            createActivityLogEntry(
                "candidate",
                candidate.id,
                authorName,
                `Call rescheduled to ${callbackDate} at ${callbackTime}. Reason: ${reason}`
            )
        );

        this.saveToStorage();
        return structuredClone(candidate);
    }

    async saveInterview(
        payload: SaveInterviewPayload,
        authorName: string
    ): Promise<Candidate> {
        const candidate = this.state.candidates.find(c => c.id === payload.candidateId);
        if (!candidate) throw new Error("Candidate not found.");

        if (
            payload.status === "Rescheduled" &&
            (!payload.rescheduleReason || !payload.rescheduleReason.trim())
        ) {
            throw new Error("A reason is mandatory when rescheduling an interview.");
        }

        const now = new Date().toISOString();
        if (payload.overrideGateReason?.trim()) {
            candidate.stepOverrides = candidate.stepOverrides || [];
            candidate.stepOverrides.push({
                step: payload.round === "HR" ? 4 : payload.round === "Technical" ? 5 : 6,
                reason: payload.overrideGateReason.trim(),
                overriddenBy: authorName,
                timestamp: now,
            });
        }

        const existingIdx = candidate.interviews.findIndex(i => i.round === payload.round);
        const interviewRecord = {
            id: existingIdx >= 0 ? candidate.interviews[existingIdx]!.id : `int-${Date.now()}`,
            candidateId: candidate.id,
            vacancyId: candidate.vacancyId,
            round: payload.round,
            interviewDate: payload.interviewDate,
            interviewTime: payload.interviewTime,
            mode: payload.mode || "Offline",
            interviewer: payload.interviewer,
            status: payload.status,
            rescheduleReason: payload.rescheduleReason || null,
            overallRating: payload.overallRating ?? null,
            technicalRating: payload.technicalRating ?? null,
            communicationRating: payload.communicationRating ?? null,
            domainKnowledgeRating: payload.domainKnowledgeRating ?? null,
            hrRecommendation: payload.hrRecommendation ?? null,
            technicalRecommendation: payload.technicalRecommendation ?? null,
            directorDecision: payload.directorDecision ?? null,
            remarks: payload.remarks.trim(),
            updatedAt: now,
        };

        if (existingIdx >= 0) {
            candidate.interviews[existingIdx] = interviewRecord;
        } else {
            candidate.interviews.push(interviewRecord);
        }

        // Check if rejected in any round
        const isRejected =
            payload.hrRecommendation === "Reject" ||
            payload.technicalRecommendation === "Reject" ||
            payload.directorDecision === "Rejected";

        if (isRejected) {
            candidate.closure = {
                finalStatus: "Rejected",
                closureDate: todayIsoDate(),
                closedBy: authorName,
                closingRemarks: `Rejected in ${payload.round} Interview: ${payload.remarks.trim() || "Did not meet criteria"}`,
            };
        }

        if (payload.round === "Technical" && payload.technicalRecommendation) {
            notify("TECHNICAL_INTERVIEW_COMPLETED", {
                candidateCode: candidate.candidateCode,
                candidateName: candidate.candidateName,
                interviewer: payload.interviewer,
                recommendation: payload.technicalRecommendation,
            });
        }

        if (payload.round === "Director" && payload.directorDecision) {
            notify("DIRECTOR_INTERVIEW_COMPLETED", {
                candidateCode: candidate.candidateCode,
                candidateName: candidate.candidateName,
                director: payload.interviewer,
                decision: payload.directorDecision,
            });
        }

        this.syncCandidateDerivedStatus(candidate);
        candidate.updatedAt = now;

        const decisionSummary =
            payload.hrRecommendation ||
            payload.technicalRecommendation ||
            payload.directorDecision ||
            payload.status;

        candidate.activityLog.unshift(
            createActivityLogEntry(
                "candidate",
                candidate.id,
                authorName,
                `${payload.round} Interview (${payload.interviewDate} ${payload.interviewTime}) updated: ${decisionSummary}.${
                    payload.rescheduleReason ? ` Reschedule reason: ${payload.rescheduleReason}` : ""
                }`
            )
        );

        this.saveToStorage();
        return structuredClone(candidate);
    }

    async saveOffer(payload: SaveOfferPayload, authorName: string): Promise<Candidate> {
        const candidate = this.state.candidates.find(c => c.id === payload.candidateId);
        if (!candidate) throw new Error("Candidate not found.");

        const now = new Date().toISOString();
        if (payload.overrideGateReason?.trim()) {
            candidate.stepOverrides = candidate.stepOverrides || [];
            candidate.stepOverrides.push({
                step: 7,
                reason: payload.overrideGateReason.trim(),
                overriddenBy: authorName,
                timestamp: now,
            });
        }

        candidate.offer = {
            candidateId: candidate.id,
            offeredPosition: payload.offeredPosition || candidate.appliedRole,
            offeredSalary: payload.offeredSalary,
            joiningDate: payload.joiningDate,
            offerExpiryDate: payload.offerExpiryDate,
            hrRemarks: payload.hrRemarks.trim(),
            offerLetterMode: payload.offerLetterMode,
            offerLetterFileName:
                payload.offerLetterFileName ||
                `Offer_Letter_${candidate.candidateCode}_${candidate.candidateName.replace(/\s+/g, "_")}.pdf`,
            candidateResponse: payload.candidateResponse,
            releasedAt: now,
        };

        if (payload.candidateResponse === "Rejected") {
            candidate.closure = {
                finalStatus: "Offer Declined",
                closureDate: todayIsoDate(),
                closedBy: authorName,
                closingRemarks: `Candidate declined offer: ${payload.hrRemarks.trim()}`,
            };
        }

        notify("OFFER_LETTER_RELEASED", {
            candidateCode: candidate.candidateCode,
            candidateName: candidate.candidateName,
            email: candidate.email,
            offeredPosition: candidate.offer.offeredPosition,
            joiningDate: candidate.offer.joiningDate,
            response: candidate.offer.candidateResponse,
        });

        this.syncCandidateDerivedStatus(candidate);
        candidate.updatedAt = now;
        candidate.activityLog.unshift(
            createActivityLogEntry(
                "candidate",
                candidate.id,
                authorName,
                `Step 7 Offer Letter released (Joining: ${payload.joiningDate}, Response: ${payload.candidateResponse}).`
            )
        );

        this.saveToStorage();
        return structuredClone(candidate);
    }

    async saveJoining(payload: SaveJoiningPayload, authorName: string): Promise<Candidate> {
        const candidate = this.state.candidates.find(c => c.id === payload.candidateId);
        if (!candidate) throw new Error("Candidate not found.");

        const vacancy = this.state.vacancies.find(v => v.id === candidate.vacancyId);
        const now = new Date().toISOString();

        if (payload.overrideGateReason?.trim()) {
            candidate.stepOverrides = candidate.stepOverrides || [];
            candidate.stepOverrides.push({
                step: 8,
                reason: payload.overrideGateReason.trim(),
                overriddenBy: authorName,
                timestamp: now,
            });
        }

        const wasAlreadyJoined = candidate.joining?.joiningStatus === "Joined";
        const autoEmpId =
            payload.employeeId?.trim() ||
            candidate.joining?.employeeId ||
            `EMP-${String(100 + this.state.candidates.length).padStart(3, "0")}`;

        candidate.joining = {
            candidateId: candidate.id,
            joiningDate: payload.joiningDate,
            employeeId: autoEmpId,
            department: vacancy?.functionName || "Operations",
            reportingManager: vacancy?.reportingTo || "Reporting Manager",
            joiningStatus: payload.joiningStatus,
            documentsSubmitted: structuredClone(payload.documentsSubmitted),
            remarks: payload.remarks.trim(),
            updatedAt: now,
        };

        if (payload.joiningStatus === "Joined") {
            // 1. Reduce vacancy Remaining seats by 1 if not already decremented (Section 6 Step 8)
            if (vacancy && !wasAlreadyJoined) {
                vacancy.remainingVacancies = Math.max(0, vacancy.remainingVacancies - 1);
                vacancy.updatedAt = now;
                vacancy.activityLog.unshift(
                    createActivityLogEntry(
                        "vacancy",
                        vacancy.id,
                        authorName,
                        `Candidate ${candidate.candidateCode} (${candidate.candidateName}) joined. Remaining seats: ${vacancy.remainingVacancies}/${vacancy.totalVacancies}.`
                    )
                );
            }

            // 2. Mark recruitment closed for candidate
            candidate.closure = {
                finalStatus: "Joined",
                closureDate: payload.joiningDate || todayIsoDate(),
                closedBy: authorName,
                closingRemarks:
                    payload.remarks.trim() ||
                    `Joined as ${autoEmpId} under ${vacancy?.reportingTo || "Manager"}.`,
            };

            // 3. Call stub onCandidateJoined(payload) for Employee Master (Rule 7 & Step 8)
            onCandidateJoined({
                candidateId: candidate.id,
                candidateCode: candidate.candidateCode,
                candidateName: candidate.candidateName,
                email: candidate.email,
                contactNo: candidate.contactNo,
                employeeId: autoEmpId,
                department: candidate.joining.department,
                designation: candidate.appliedRole,
                reportingManager: candidate.joining.reportingManager,
                joiningDate: payload.joiningDate,
                offeredSalary: candidate.offer?.offeredSalary ?? null,
            });

            notify("CANDIDATE_JOINED", {
                candidateCode: candidate.candidateCode,
                candidateName: candidate.candidateName,
                employeeId: autoEmpId,
            });

            // 4. Update Referral Payment Due Date (Joining Date + 90 days) if Employee Referral (Section 8)
            if (candidate.source === "Employee Referral") {
                const ref = this.state.referrals.find(r => r.candidateId === candidate.id);
                const dueDate = calculateReferralPaymentDueDate(
                    payload.joiningDate,
                    "Joined",
                    candidate.source
                );
                if (ref) {
                    ref.joiningDate = payload.joiningDate;
                    ref.paymentDueDate = dueDate;
                    ref.updatedAt = now;
                }
            }
        } else if (payload.joiningStatus === "Did Not Join") {
            // Reopen the vacancy if seats remain (Section 6 Step 8)
            if (vacancy) {
                if (wasAlreadyJoined) {
                    vacancy.remainingVacancies = Math.min(
                        vacancy.totalVacancies,
                        vacancy.remainingVacancies + 1
                    );
                }
                if (vacancy.remainingVacancies > 0 && vacancy.status === "Filled") {
                    vacancy.status = "Active";
                    vacancy.activityLog.unshift(
                        createActivityLogEntry(
                            "vacancy",
                            vacancy.id,
                            authorName,
                            `Vacancy automatically reopened to Active because ${candidate.candidateCode} Did Not Join and ${vacancy.remainingVacancies} seat(s) remain.`
                        )
                    );
                }
            }

            candidate.closure = {
                finalStatus: "Did Not Join",
                closureDate: todayIsoDate(),
                closedBy: authorName,
                closingRemarks: payload.remarks.trim() || "Candidate Did Not Join.",
            };

            if (candidate.source === "Employee Referral") {
                const ref = this.state.referrals.find(r => r.candidateId === candidate.id);
                if (ref) {
                    ref.joiningDate = null;
                    ref.paymentDueDate = null;
                    ref.updatedAt = now;
                }
            }
        }

        this.syncCandidateDerivedStatus(candidate);
        candidate.updatedAt = now;
        candidate.activityLog.unshift(
            createActivityLogEntry(
                "candidate",
                candidate.id,
                authorName,
                `Step 8 Joining status updated to ${payload.joiningStatus} (Date: ${payload.joiningDate}, Employee ID: ${autoEmpId}).`
            )
        );

        this.saveToStorage();
        return structuredClone(candidate);
    }

    async saveClosure(payload: SaveClosurePayload, authorName: string): Promise<Candidate> {
        const candidate = this.state.candidates.find(c => c.id === payload.candidateId);
        if (!candidate) throw new Error("Candidate not found.");

        const now = new Date().toISOString();
        candidate.closure = {
            finalStatus: payload.finalStatus,
            closureDate: todayIsoDate(),
            closedBy: authorName,
            closingRemarks: payload.closingRemarks.trim(),
        };

        this.syncCandidateDerivedStatus(candidate);
        candidate.updatedAt = now;
        candidate.activityLog.unshift(
            createActivityLogEntry(
                "candidate",
                candidate.id,
                authorName,
                `Step 10 Recruitment Closure: ${payload.finalStatus}. ${payload.closingRemarks.trim()}`
            )
        );

        this.saveToStorage();
        return structuredClone(candidate);
    }

    async reopenCandidate(
        candidateId: string,
        reason: string,
        authorName: string
    ): Promise<Candidate> {
        const candidate = this.state.candidates.find(c => c.id === candidateId);
        if (!candidate) throw new Error("Candidate not found.");
        if (!reason.trim()) throw new Error("A reason is required to reopen a closed candidate.");

        candidate.closure = null;
        candidate.isClosed = false;
        candidate.reopenReason = reason.trim();

        // If screening or call outcome had closed them, reset to active stage
        if (candidate.screening?.decision === "Pruning Rejected") {
            candidate.screening.decision = "Pruning Cleared";
        }
        const latestCall = candidate.callLogs[candidate.callLogs.length - 1];
        if (latestCall?.outcome === "Not Interested") {
            latestCall.outcome = "Call Back";
            latestCall.callbackDate = todayIsoDate();
        }

        this.syncCandidateDerivedStatus(candidate);
        candidate.updatedAt = new Date().toISOString();
        candidate.activityLog.unshift(
            createActivityLogEntry(
                "candidate",
                candidate.id,
                authorName,
                `Candidate reopened by HR. Reason: ${reason.trim()}`
            )
        );

        this.saveToStorage();
        return structuredClone(candidate);
    }

    async logWhatsAppMessage(
        candidateId: string,
        templateTitle: string,
        recipient: string,
        body: string,
        authorName: string
    ): Promise<Candidate> {
        const candidate = this.state.candidates.find(c => c.id === candidateId);
        if (!candidate) throw new Error("Candidate not found.");

        const now = new Date().toISOString();
        const msgLog: SentMessageLog = {
            id: `msg-${Date.now()}`,
            candidateId: candidate.id,
            channel: "WhatsApp",
            templateTitle,
            recipient,
            body,
            sentAt: now,
            sentBy: authorName,
        };

        candidate.messagesSent.unshift(msgLog);
        candidate.updatedAt = now;
        candidate.activityLog.unshift(
            createActivityLogEntry(
                "candidate",
                candidate.id,
                authorName,
                `WhatsApp message sent ("${templateTitle}") to ${recipient}.`
            )
        );

        this.saveToStorage();
        return structuredClone(candidate);
    }

    async addCandidateNote(
        candidateId: string,
        note: string,
        authorName: string
    ): Promise<Candidate> {
        const candidate = this.state.candidates.find(c => c.id === candidateId);
        if (!candidate) throw new Error("Candidate not found.");
        if (!note.trim()) return structuredClone(candidate);

        candidate.activityLog.unshift(
            createActivityLogEntry("candidate", candidate.id, authorName, note.trim())
        );
        candidate.updatedAt = new Date().toISOString();
        this.saveToStorage();
        return structuredClone(candidate);
    }

    async listReferrals(): Promise<Referral[]> {
        return structuredClone(this.state.referrals);
    }

    async updateReferral(payload: SaveReferralPayload, authorName: string): Promise<Referral> {
        const ref = this.state.referrals.find(r => r.id === payload.referralId);
        if (!ref) throw new Error("Referral record not found.");

        const candidate = this.state.candidates.find(c => c.id === ref.candidateId);
        const now = new Date().toISOString();

        ref.referralAmount = payload.referralAmount;
        // Enforce Section 8: never calculate or set paymentDueDate if candidate has not Joined
        if (candidate?.currentStatus === "Joined" && candidate.joining?.joiningDate) {
            ref.paymentDueDate =
                payload.paymentDueDate ||
                calculateReferralPaymentDueDate(
                    candidate.joining.joiningDate,
                    "Joined",
                    candidate.source
                );
        } else {
            ref.paymentDueDate = null;
        }
        ref.paymentStatus = payload.paymentStatus;
        ref.paymentDate = payload.paymentStatus === "Paid" ? payload.paymentDate || todayIsoDate() : payload.paymentDate;
        ref.remarks = payload.remarks.trim();
        ref.updatedAt = now;

        if (candidate) {
            candidate.activityLog.unshift(
                createActivityLogEntry(
                    "candidate",
                    candidate.id,
                    authorName,
                    `Step 9 Referral payout updated: Status = ${ref.paymentStatus}${
                        ref.paymentDueDate ? `, Due = ${ref.paymentDueDate}` : ""
                    }.`
                )
            );
        }

        notify("REFERRAL_PAYOUT_UPDATED", {
            candidateCode: ref.candidateCode,
            referrer: ref.referrer,
            paymentStatus: ref.paymentStatus,
        });

        this.saveToStorage();
        return structuredClone(ref);
    }

    async listWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
        return structuredClone(this.state.whatsappTemplates);
    }
}

/**
 * Optional HTTP Repository Adapter targeting /recruitment endpoints (Rule 6 & Section 9).
 * Isolated so it can be swapped in with a single line change when backend endpoints are deployed.
 */
export class HttpRecruitmentRepository extends BaseApiService {
    constructor() {
        super("/recruitment");
    }
}

export const recruitmentRepository: IRecruitmentRepository = new InMemoryRecruitmentRepository();
export { SAMPLE_EMPLOYEES, SAMPLE_LOCATIONS };
