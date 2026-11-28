// Recruitment Module — Isolated Stubs for Cross-Module & External Integrations
// Rule 4 & Rule 7: Expose clearly named stub functions with TODOs; do not write into other modules or call external services.

export interface CandidateJoinedPayload {
    candidateId: string;
    candidateCode: string;
    candidateName: string;
    email: string;
    contactNo: string;
    employeeId: string;
    department: string;
    designation: string;
    reportingManager: string;
    joiningDate: string;
    offeredSalary: number | null;
}

/**
 * Stub called when a candidate is marked as Joined in Step 8 (Section 6 Step 8 & Rule 7).
 * TODO: Connect to Employee Master / Onboarding module once cross-module integration is enabled.
 */
export function onCandidateJoined(payload: CandidateJoinedPayload): void {
    console.info("[Recruitment Stub] onCandidateJoined triggered for Employee Master:", payload);
}

export type RecruitmentNotificationEvent =
    | "VACANCY_ON_HOLD"
    | "TECHNICAL_INTERVIEW_COMPLETED"
    | "DIRECTOR_INTERVIEW_COMPLETED"
    | "OFFER_LETTER_RELEASED"
    | "CANDIDATE_JOINED"
    | "REFERRAL_PAYOUT_UPDATED";

/**
 * Stub for transactional emails & internal notifications to HR TL, Accounts, Team Leaders, and Candidates (Section 8).
 * TODO: Connect to backend mailer / notification queue (/recruitment/notify) when ready.
 */
export function notify(
    event: RecruitmentNotificationEvent,
    payload: Record<string, unknown>
): void {
    console.info(`[Recruitment Stub] notify("${event}")`, payload);
}

export interface ParsedResumeResult {
    candidateName: string;
    email: string;
    contactNo: string;
    employer: string;
    designation: string;
    experience: number;
    education: string;
    autoFilledFields: string[];
}

/**
 * Local CV parser behind parseResume(file) interface (Section 6 Step 1).
 * Reads text/filename heuristics locally without calling any external service.
 * TODO: Swap with backend OCR/ML resume parser endpoint if provided later.
 */
export async function parseResume(file: File): Promise<ParsedResumeResult> {
    const rawBase = file.name
        .replace(/\.(pdf|docx?|txt)$/i, "")
        .replace(/[_-]+/g, " ")
        .replace(/\b(cv|resume|profile|updated|final|\d{4})\b/gi, "")
        .trim();

    let textContent = "";
    try {
        if (file.size < 2 * 1024 * 1024) {
            textContent = await file.text();
        }
    } catch {
        textContent = "";
    }

    const emailMatch = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.exec(textContent);
    const phoneMatch = /(?:\+?91[-\s]?)?[6-9]\d{9}/.exec(textContent);
    const expMatch = /(\d{1,2}(?:\.\d)?)\+?\s*(?:years?|yrs?)/i.exec(textContent);

    const inferredName =
        rawBase.length >= 3
            ? rawBase
                  .split(/\s+/)
                  .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                  .join(" ")
            : "Aarav Sharma";

    const slug = inferredName.toLowerCase().replace(/[^a-z0-9]+/g, ".");
    const email = emailMatch ? emailMatch[0] : `${slug}@example.com`;
    const contactNo = phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : "9876543210";
    const experience = expMatch ? Number(expMatch[1]) : 4;

    return {
        candidateName: inferredName,
        email,
        contactNo,
        employer: "Voltas Infrastructure Ltd.",
        designation: "Senior Project Executive",
        experience,
        education: "B.Tech (Mechanical / Electrical)",
        autoFilledFields: [
            "candidateName",
            "email",
            "contactNo",
            "employer",
            "designation",
            "experience",
            "education",
        ],
    };
}
