import type {
    ActivityLog,
    CallOutcome,
    Candidate,
    CandidateCurrentStatus,
    CandidateStageBucket,
    ClosureFinalStatus,
    DirectorDecision,
    HrRecommendation,
    JoiningOutcomeStatus,
    ScreeningDecision,
    TechnicalRecommendation,
    Vacancy,
} from "./types";

/**
 * Returns today's date as ISO YYYY-MM-DD
 */
export function todayIsoDate(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/**
 * Formats an ISO date string (YYYY-MM-DD or full ISO) to DD-MM-YYYY (Section 4)
 */
export function formatDdMmYyyy(isoDate: string | null | undefined): string {
    if (!isoDate) return "—";
    const clean = String(isoDate).trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        const [y, m, d] = clean.split("-");
        return `${d}-${m}-${y}`;
    }
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) return "—";
    const d = String(parsed.getDate()).padStart(2, "0");
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const y = parsed.getFullYear();
    return `${d}-${m}-${y}`;
}

/**
 * Formats an ISO date or Date to DD.MM.YY for Activity Logs (Section 8)
 */
export function formatActivityDate(isoOrDate?: string | Date): string {
    const d = isoOrDate ? new Date(isoOrDate) : new Date();
    const valid = Number.isNaN(d.getTime()) ? new Date() : d;
    const day = String(valid.getDate()).padStart(2, "0");
    const month = String(valid.getMonth() + 1).padStart(2, "0");
    const year = String(valid.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
}

/**
 * Extracts 2-3 character initials from an author's full name
 */
export function getInitials(name: string | null | undefined): string {
    if (!name || !name.trim() || name.trim() === "-") return "HR";
    const parts = name
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (parts.length === 1) {
        return parts[0]!.slice(0, 2).toUpperCase();
    }
    return parts
        .slice(0, 3)
        .map(p => p[0]!.toUpperCase())
        .join("");
}

/**
 * Builds an ActivityLog entry formatted as "DD.MM.YY: Initials: Note" (Section 8)
 */
export function createActivityLogEntry(
    entityType: "vacancy" | "candidate",
    entityId: string,
    authorName: string,
    note: string,
    timestampIso?: string
): ActivityLog {
    const ts = timestampIso || new Date().toISOString();
    const formattedDate = formatActivityDate(ts);
    const initials = getInitials(authorName);
    return {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        entityType,
        entityId,
        timestamp: ts,
        formattedDate,
        initials,
        authorName: authorName || "HR",
        note: note.trim(),
    };
}

/**
 * Formats a single ActivityLog line per Section 8: "DD.MM.YY: Initials: Note"
 */
export function formatActivityLogLine(log: ActivityLog): string {
    return `${log.formattedDate}: ${log.initials}: ${log.note}`;
}

/**
 * Auto-calculates Days Open from startDate to today (or 0 if future)
 */
export function calculateDaysOpen(startDateIso: string, status?: string): number {
    if (!startDateIso) return 0;
    const clean = startDateIso.slice(0, 10);
    const [y, m, d] = clean.split("-").map(Number);
    if (!y || !m || !d) return 0;
    const start = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = today.getTime() - start.getTime();
    if (diffMs <= 0) return 0;
    if (status === "Filled") return Math.max(1, Math.floor(diffMs / 86_400_000));
    return Math.floor(diffMs / 86_400_000);
}

/**
 * Calculates filled and open seat counts for a vacancy based on joined candidates (or status === 'Filled').
 */
export function getVacancySeatSummary(
    vacancy: Pick<Vacancy, "id" | "totalVacancies" | "status">,
    candidates: Array<Pick<Candidate, "vacancyId" | "currentStatus">>
): { filledSeats: number; totalSeats: number; openSeats: number } {
    const totalSeats = Math.max(1, vacancy.totalVacancies || 1);
    const joinedForVacancy = candidates.filter(
        c => c.vacancyId === vacancy.id && c.currentStatus === "Joined"
    ).length;
    const filledSeats =
        vacancy.status === "Filled"
            ? Math.max(totalSeats, joinedForVacancy)
            : Math.min(totalSeats, joinedForVacancy);
    const openSeats = Math.max(0, totalSeats - filledSeats);
    return { filledSeats, totalSeats, openSeats };
}

/**
 * Generates next VC-### code for vacancies (Section 8)
 */
export function generateNextVacancyCode(existingCodes: string[]): string {
    let maxNum = 0;
    for (const code of existingCodes) {
        const match = /^VC-(\d+)$/i.exec(code.trim());
        if (match) {
            const num = parseInt(match[1]!, 10);
            if (num > maxNum) maxNum = num;
        }
    }
    return `VC-${String(maxNum + 1).padStart(3, "0")}`;
}

/**
 * Generates next RC-### code for candidates (Section 8)
 */
export function generateNextCandidateCode(existingCodes: string[]): string {
    let maxNum = 0;
    for (const code of existingCodes) {
        const match = /^RC-(\d+)$/i.exec(code.trim());
        if (match) {
            const num = parseInt(match[1]!, 10);
            if (num > maxNum) maxNum = num;
        }
    }
    return `RC-${String(maxNum + 1).padStart(3, "0")}`;
}

/**
 * Formats salary range or placeholder [AMOUNT] (Section 11)
 */
export function formatSalaryRangeDisplay(
    min: number | null | undefined,
    max: number | null | undefined,
    period: string = "Per Month",
    isSample?: boolean
): string {
    const shortPeriod = period === "Per Annum" ? "P.A." : "P.M.";
    if ((min === null || min === undefined) && (max === null || max === undefined)) {
        return isSample ? `[AMOUNT] ${shortPeriod}` : "—";
    }
    const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
    if (min !== null && min !== undefined && max !== null && max !== undefined) {
        return `${fmt(min)} – ${fmt(max)} ${shortPeriod}`;
    }
    if (min !== null && min !== undefined) return `From ${fmt(min)} ${shortPeriod}`;
    if (max !== null && max !== undefined) return `Up to ${fmt(max)} ${shortPeriod}`;
    return "—";
}

/**
 * Formats a single currency amount or returns "[AMOUNT]" for unset sample records (Section 11)
 */
export function formatAmountOrPlaceholder(
    amount: number | null | undefined,
    isSample?: boolean
): string {
    if (amount === null || amount === undefined) {
        return isSample ? "[AMOUNT]" : "—";
    }
    return `₹${Number(amount).toLocaleString("en-IN")}`;
}

/**
 * Calculates overall screening score (average of primary & secondary to 1 decimal) (Section 6 Step 2)
 */
export function calculateOverallScreeningScore(primary: number, secondary: number): number {
    const avg = (Number(primary) + Number(secondary)) / 2;
    return Math.round(avg * 10) / 10;
}

/**
 * Role dropdown eligibility rule (Section 6 Step 1 & Section 8):
 * "Only Active vacancies with a Finalized JD appear in the candidate Role dropdown and referral list."
 */
export function getEligibleVacanciesForCandidateRole(vacancies: Vacancy[]): Vacancy[] {
    return vacancies.filter(v => v.status === "Active" && v.jdStatus === "Finalized");
}

/**
 * Checks if a vacancy position title is unique among open (Active / On Hold) roles (Section 5)
 */
export function isPositionUniqueAmongOpenRoles(
    position: string,
    vacancies: Vacancy[],
    excludeVacancyId?: string
): boolean {
    const target = position.trim().toLowerCase();
    if (!target) return false;
    return !vacancies.some(
        v =>
            v.id !== excludeVacancyId &&
            v.status !== "Filled" &&
            v.position.trim().toLowerCase() === target
    );
}

/**
 * Referral due date calculation (Section 8 & Section 6 Step 9):
 * "Joining Date + 90 days, only when the candidate Joined and Source is Employee Referral. Never calculate it for blank dates."
 */
export function calculateReferralPaymentDueDate(
    joiningDateIso: string | null | undefined,
    joiningStatus: JoiningOutcomeStatus | CandidateCurrentStatus | null | undefined,
    source: string
): string | null {
    if (source !== "Employee Referral") return null;
    if (joiningStatus !== "Joined") return null;
    if (!joiningDateIso || !joiningDateIso.trim()) return null;

    const clean = joiningDateIso.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;

    const [y, m, d] = clean.split("-").map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    if (Number.isNaN(dt.getTime())) return null;

    dt.setDate(dt.getDate() + 90);
    const ry = dt.getFullYear();
    const rm = String(dt.getMonth() + 1).padStart(2, "0");
    const rd = String(dt.getDate()).padStart(2, "0");
    return `${ry}-${rm}-${rd}`;
}

/**
 * Checks if a referral due date is due within the next 7 days (or overdue and unpaid) (Section 6 Step 9)
 */
export function isReferralDueWithin7Days(
    paymentDueDateIso: string | null | undefined,
    paymentStatus: string
): boolean {
    if (paymentStatus === "Paid" || !paymentDueDateIso) return false;
    const clean = paymentDueDateIso.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return false;
    const [y, m, d] = clean.split("-").map(Number);
    if (!y || !m || !d) return false;
    const due = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
    return diffDays <= 7;
}

/**
 * Derives Candidate Current Status, Stage Bucket, Next Action, and Closed flag from stage outcomes (Section 6)
 */
export function deriveCandidateState(params: {
    screeningDecision?: ScreeningDecision | null;
    latestCallOutcome?: CallOutcome | null;
    hrRecommendation?: HrRecommendation | null;
    technicalRecommendation?: TechnicalRecommendation | null;
    directorDecision?: DirectorDecision | null;
    hasTechnicalInterviewScheduled?: boolean;
    hasDirectorInterviewScheduled?: boolean;
    offerReleased?: boolean;
    offerResponse?: string | null;
    joiningStatus?: JoiningOutcomeStatus | null;
    closureStatus?: ClosureFinalStatus | null;
}): {
    currentStatus: CandidateCurrentStatus;
    stageBucket: CandidateStageBucket;
    nextAction: string;
    isClosed: boolean;
} {
    // 1. Explicit Closure
    if (params.closureStatus) {
        const isJoined = params.closureStatus === "Joined";
        return {
            currentStatus: params.closureStatus,
            stageBucket: isJoined ? "Joined" : "Closed",
            nextAction: "Process Closed",
            isClosed: true,
        };
    }

    // 2. Joining stage
    if (params.joiningStatus) {
        if (params.joiningStatus === "Joined") {
            return {
                currentStatus: "Joined",
                stageBucket: "Joined",
                nextAction: "Onboarding Completed",
                isClosed: true,
            };
        }
        if (params.joiningStatus === "Did Not Join") {
            return {
                currentStatus: "Did Not Join",
                stageBucket: "Closed",
                nextAction: "Close / Reopen Vacancy",
                isClosed: true,
            };
        }
        return {
            currentStatus: "Deferred Joining",
            stageBucket: "Offered",
            nextAction: "Confirm Revised Joining Date",
            isClosed: false,
        };
    }

    // 3. Offer stage
    if (params.offerReleased) {
        if (params.offerResponse === "Rejected") {
            return {
                currentStatus: "Offer Declined",
                stageBucket: "Closed",
                nextAction: "Close Candidate",
                isClosed: true,
            };
        }
        return {
            currentStatus: "Offer Released",
            stageBucket: "Offered",
            nextAction:
                params.offerResponse === "Accepted"
                    ? "Mark Joined (Step 8)"
                    : "Await Candidate Offer Acceptance",
            isClosed: false,
        };
    }

    // 4. Director Interview stage
    if (params.directorDecision) {
        if (params.directorDecision === "Selected") {
            return {
                currentStatus: "Selected",
                stageBucket: "Selected",
                nextAction: "Release Offer Letter (Step 7)",
                isClosed: false,
            };
        }
        if (params.directorDecision === "Rejected") {
            return {
                currentStatus: "Rejected",
                stageBucket: "Rejected",
                nextAction: "Closed (Rejected by Director)",
                isClosed: true,
            };
        }
        return {
            currentStatus: "On Hold",
            stageBucket: "With Director",
            nextAction: "Review Director Hold",
            isClosed: false,
        };
    }

    if (params.hasDirectorInterviewScheduled) {
        return {
            currentStatus: "Selected for Director Interview",
            stageBucket: "With Director",
            nextAction: "Complete Director Interview (Step 6)",
            isClosed: false,
        };
    }

    // 5. Technical / Team Leader Interview stage
    if (params.technicalRecommendation) {
        if (params.technicalRecommendation === "Selected for Director Interview") {
            return {
                currentStatus: "Selected for Director Interview",
                stageBucket: "With Director",
                nextAction: "Schedule Director Interview (Step 6)",
                isClosed: false,
            };
        }
        if (params.technicalRecommendation === "Reject") {
            return {
                currentStatus: "Rejected",
                stageBucket: "Rejected",
                nextAction: "Closed (Rejected in Technical Round)",
                isClosed: true,
            };
        }
        return {
            currentStatus: "On Hold",
            stageBucket: "With Team Leader",
            nextAction: "Review Technical Hold",
            isClosed: false,
        };
    }

    if (params.hasTechnicalInterviewScheduled) {
        return {
            currentStatus: "Shortlisted",
            stageBucket: "With Team Leader",
            nextAction: "Complete Technical Interview (Step 5)",
            isClosed: false,
        };
    }

    // 6. HR Interview stage
    if (params.hrRecommendation) {
        if (params.hrRecommendation === "Shortlist for Technical Interview") {
            return {
                currentStatus: "Shortlisted",
                stageBucket: "HR Shortlisted",
                nextAction: "Schedule Technical Interview (Step 5)",
                isClosed: false,
            };
        }
        if (params.hrRecommendation === "Reject") {
            return {
                currentStatus: "Rejected",
                stageBucket: "Rejected",
                nextAction: "Closed (Rejected in HR Round)",
                isClosed: true,
            };
        }
        return {
            currentStatus: "On Hold",
            stageBucket: "HR Shortlisted",
            nextAction: "Review HR Hold",
            isClosed: false,
        };
    }

    // 7. Screening Call stage
    if (params.latestCallOutcome) {
        const outcome = params.latestCallOutcome;
        if (outcome === "Not Interested") {
            return {
                currentStatus: "Not Interested",
                stageBucket: "Rejected",
                nextAction: "Closed (Not Interested)",
                isClosed: true,
            };
        }
        if (outcome === "Interested") {
            return {
                currentStatus: "Interested",
                stageBucket: "Interested",
                nextAction: "Schedule HR Interview (Step 4)",
                isClosed: false,
            };
        }
        if (outcome === "Semi Interested") {
            return {
                currentStatus: "Semi Interested",
                stageBucket: "Called",
                nextAction: "Follow-up Screening Call",
                isClosed: false,
            };
        }
        if (outcome === "Call Back") {
            return {
                currentStatus: "Call Back",
                stageBucket: "Called",
                nextAction: "Call Back on Scheduled Time",
                isClosed: false,
            };
        }
        return {
            currentStatus: outcome,
            stageBucket: "Called",
            nextAction: outcome === "Not Reachable" ? "Retry Call" : "Closed / Archive Check",
            isClosed: false,
        };
    }

    // 8. Screening (Pruning) stage
    if (params.screeningDecision) {
        if (params.screeningDecision === "Pruning Rejected") {
            return {
                currentStatus: "Pruning Rejected",
                stageBucket: "Rejected",
                nextAction: "Closed (Pruning Rejected)",
                isClosed: true,
            };
        }
        return {
            currentStatus: "Pruning Cleared",
            stageBucket: "Pruning",
            nextAction: "Log Screening Call (Step 3)",
            isClosed: false,
        };
    }

    return {
        currentStatus: "Pruning Cleared",
        stageBucket: "Pruning",
        nextAction: "Score Profile (Step 2)",
        isClosed: false,
    };
}

/**
 * Duplicate Check on Email or Contact No. (Section 6 Step 1)
 */
export function findDuplicateCandidate(
    candidates: Candidate[],
    email: string,
    contactNo: string,
    excludeCandidateId?: string
): Candidate | null {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = contactNo.replace(/\D/g, "").slice(-10);

    for (const c of candidates) {
        if (excludeCandidateId && c.id === excludeCandidateId) continue;
        const existingEmail = c.email.trim().toLowerCase();
        const existingPhone = c.contactNo.replace(/\D/g, "").slice(-10);
        if (cleanEmail && existingEmail && cleanEmail === existingEmail) {
            return c;
        }
        if (cleanPhone && cleanPhone.length >= 10 && existingPhone === cleanPhone) {
            return c;
        }
    }
    return null;
}

/**
 * Checks if a gated step (Steps 4..10) is naturally unlocked or requires an HR override reason (Section 6 & 8)
 */
export function checkStepGateStatus(
    candidate: Candidate,
    targetStep: 4 | 5 | 6 | 7 | 8 | 9 | 10
): { allowed: boolean; reasonIfGated: string } {
    const latestCall = candidate.callLogs[candidate.callLogs.length - 1];
    const hrInterview = candidate.interviews.find(i => i.round === "HR");
    const techInterview = candidate.interviews.find(i => i.round === "Technical");
    const dirInterview = candidate.interviews.find(i => i.round === "Director");

    switch (targetStep) {
        case 4: {
            const ok =
                latestCall?.outcome === "Interested" ||
                latestCall?.outcome === "Semi Interested" ||
                candidate.currentStatus === "Interested";
            return {
                allowed: ok,
                reasonIfGated:
                    "Step 4 (HR Interview) requires Screening Call outcome to be 'Interested'. Provide an HR override reason to proceed.",
            };
        }
        case 5: {
            const ok =
                hrInterview?.hrRecommendation === "Shortlist for Technical Interview" ||
                candidate.currentStatus === "Shortlisted" ||
                candidate.stageBucket === "With Team Leader";
            return {
                allowed: ok,
                reasonIfGated:
                    "Step 5 (Technical Interview) requires HR Interview recommendation 'Shortlist for Technical Interview'. Provide an HR override reason to proceed.",
            };
        }
        case 6: {
            const ok =
                techInterview?.technicalRecommendation === "Selected for Director Interview" ||
                candidate.currentStatus === "Selected for Director Interview" ||
                candidate.stageBucket === "With Director";
            return {
                allowed: ok,
                reasonIfGated:
                    "Step 6 (Director Interview) requires Technical Interview recommendation 'Selected for Director Interview'. Provide an HR override reason to proceed.",
            };
        }
        case 7: {
            const ok =
                dirInterview?.directorDecision === "Selected" ||
                candidate.currentStatus === "Selected" ||
                candidate.stageBucket === "Selected" ||
                candidate.stageBucket === "Offered";
            return {
                allowed: ok,
                reasonIfGated:
                    "Step 7 (Offer Letter) requires Director Interview decision 'Selected'. Provide an HR override reason to proceed.",
            };
        }
        case 8: {
            const ok =
                Boolean(candidate.offer) ||
                candidate.currentStatus === "Offer Released" ||
                candidate.stageBucket === "Offered" ||
                candidate.stageBucket === "Joined";
            return {
                allowed: ok,
                reasonIfGated:
                    "Step 8 (Joining & Onboarding) requires an Offer Letter to be released first. Provide an HR override reason to proceed.",
            };
        }
        case 9: {
            const ok = candidate.source === "Employee Referral";
            return {
                allowed: ok,
                reasonIfGated: "Step 9 (Referral Management) is only for Employee Referral candidates.",
            };
        }
        case 10:
            return { allowed: true, reasonIfGated: "" };
    }
}

/**
 * Fills WhatsApp template placeholders and generates a wa.me URL (Section 8)
 */
export function interpolateWhatsAppTemplate(
    templateBody: string,
    vars: {
        candidateName?: string;
        role?: string;
        interviewTime?: string;
        amount?: string;
        company?: string;
    }
): string {
    return templateBody
        .replace(/\{\{candidateName\}\}/g, vars.candidateName || "Candidate")
        .replace(/\{\{role\}\}/g, vars.role || "the applied position")
        .replace(/\{\{interviewTime\}\}/g, vars.interviewTime || "the scheduled slot")
        .replace(/\{\{amount\}\}/g, vars.amount || "[AMOUNT]")
        .replace(/\{\{company\}\}/g, vars.company || "Pairan / Volks Energie");
}

export function buildWaMeUrl(phone: string, text: string): string {
    const digits = phone.replace(/\D/g, "");
    const normalizedPhone = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Downloads filtered rows as a UTF-8 CSV file (Section 8)
 */
export function downloadRecruitmentCsv(
    filename: string,
    headers: string[],
    rows: Array<Array<string | number | null | undefined>>
): void {
    const escapeCell = (v: string | number | null | undefined) => {
        const s = v === null || v === undefined ? "" : String(v);
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    };
    const lines = [
        headers.map(escapeCell).join(","),
        ...rows.map(r => r.map(escapeCell).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
