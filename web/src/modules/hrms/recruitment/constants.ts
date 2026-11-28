import type {
    CallOutcome,
    CandidateSource,
    ClosureFinalStatus,
    DirectorDecision,
    DocumentChecklistItem,
    HrRecommendation,
    InterviewMode,
    InterviewStatus,
    JDStatus,
    JoiningOutcomeStatus,
    OfferResponseStatus,
    ProgressKey,
    ProgressStepStatus,
    RecruitmentTab,
    ReferralPaymentStatus,
    SalaryPeriod,
    ScreeningDecision,
    TechnicalRecommendation,
    VacancyProgress,
    VacancySearchString,
    VacancyStatus,
} from "./types";

export const RECRUITMENT_TABS: Array<{ key: RecruitmentTab; label: string }> = [
    { key: "vacancies", label: "Vacancies" },
    { key: "candidates", label: "Candidates" },
    { key: "todays-calls", label: "Today's Calls" },
    { key: "interviews", label: "Interviews" },
    { key: "referrals", label: "Referrals" },
    { key: "whatsapp-templates", label: "WhatsApp Templates" },
    { key: "reference", label: "Reference" },
    { key: "filled-archive", label: "Filled Archive" },
];

export const DEFAULT_VACANCY_FUNCTIONS: string[] = ["Admin.", "HVAC", "DC", "F&A"];

export const VACANCY_STATUSES: VacancyStatus[] = ["Active", "On Hold", "Filled"];

export const JD_STATUSES: JDStatus[] = ["Not Started", "In Progress", "Finalized"];

export const SALARY_PERIODS: SalaryPeriod[] = ["Per Month", "Per Annum"];

export const PROGRESS_STEP_STATUSES: ProgressStepStatus[] = [
    "Not Started",
    "In Progress",
    "Done",
];

export const ROLE_PROGRESS_ITEMS: Array<{ key: ProgressKey; label: string }> = [
    { key: "jd", label: "JD" },
    { key: "sourcing", label: "Sourcing" },
    { key: "pruning", label: "Pruning" },
    { key: "enrollmentAndScreening", label: "Enrollment and Screening" },
    { key: "coordinationWithCandidates", label: "Coordination with Candidates" },
    { key: "coordinationWithHiringManagers", label: "Coordination with Hiring Managers" },
    { key: "offer", label: "Offer" },
];

export const CANDIDATE_SOURCES: CandidateSource[] = [
    "Naukri Resdex",
    "LinkedIn",
    "Employee Referral",
    "Website",
    "Direct Contact",
    "Walk-in",
    "Consultant",
];

export const SCREENING_DECISIONS: ScreeningDecision[] = [
    "Pruning Cleared",
    "Pruning Rejected",
];

export const CALL_OUTCOMES: CallOutcome[] = [
    "Interested",
    "Semi Interested",
    "Call Back",
    "Not Reachable",
    "Perpetually Not Reachable",
    "Not Interested",
];

export const INTERVIEW_MODES: InterviewMode[] = [
    "Offline",
    "Online (Google Meet / Teams)",
    "Telephonic",
];

export const INTERVIEW_STATUSES: InterviewStatus[] = [
    "Scheduled",
    "Completed",
    "Rescheduled",
    "Cancelled",
    "No Show",
];

export const HR_RECOMMENDATIONS: HrRecommendation[] = [
    "Shortlist for Technical Interview",
    "Hold",
    "Reject",
];

export const TECHNICAL_RECOMMENDATIONS: TechnicalRecommendation[] = [
    "Selected for Director Interview",
    "Hold",
    "Reject",
];

export const DIRECTOR_DECISIONS: DirectorDecision[] = ["Selected", "Hold", "Rejected"];

export const OFFER_RESPONSES: OfferResponseStatus[] = ["Accepted", "Rejected", "Pending"];

export const JOINING_STATUSES: JoiningOutcomeStatus[] = [
    "Joined",
    "Did Not Join",
    "Deferred Joining",
];

export const REFERRAL_PAYMENT_STATUSES: ReferralPaymentStatus[] = [
    "Pending",
    "Approved",
    "Paid",
];

export const CLOSURE_FINAL_STATUSES: ClosureFinalStatus[] = [
    "Joined",
    "Rejected",
    "Offer Declined",
    "Position Closed",
    "Did Not Join",
];

export const DEFAULT_DOCUMENT_CHECKLIST: DocumentChecklistItem[] = [
    { key: "aadhaar_pan", label: "Aadhaar & PAN Card", submitted: false },
    { key: "education_certs", label: "Educational Certificates", submitted: false },
    { key: "relieving_letter", label: "Previous Employer Relieving / Experience Letter", submitted: false },
    { key: "salary_slips", label: "Last 3 Months Salary Slips & Bank Statement", submitted: false },
    { key: "photos_bank", label: "Passport Photos & Cancelled Cheque", submitted: false },
];

export function createEmptyVacancyProgress(): VacancyProgress {
    return {
        jd: { status: "Not Started", note: "" },
        sourcing: { status: "Not Started", note: "" },
        pruning: { status: "Not Started", note: "" },
        enrollmentAndScreening: { status: "Not Started", note: "" },
        coordinationWithCandidates: { status: "Not Started", note: "" },
        coordinationWithHiringManagers: { status: "Not Started", note: "" },
        offer: { status: "Not Started", note: "" },
    };
}

export function createEmptySearchStrings(): VacancySearchString {
    return {
        keywords: "",
        booleanQuery: "",
        experience: "",
        location: "",
        salary: "",
        departmentAndRole: "",
        industry: "",
        company: "",
        designation: "",
        education: "",
        dAndI: "",
    };
}

export const VACANCY_STAGE_BUCKETS = [
    "Pruning",
    "Called",
    "HR Shortlisted",
    "With Team Leader",
    "With Director",
    "Selected",
    "Offered",
    "Joined",
    "Closed",
] as const;
