// Recruitment Module — Typed Entities & Payloads

export type RecruitmentTab =
    | "vacancies"
    | "candidates"
    | "todays-calls"
    | "interviews"
    | "referrals"
    | "whatsapp-templates"
    | "reference"
    | "filled-archive";

export type RecruitmentRole = "HR" | "Team Leader" | "Director" | "Leadership";

export type VacancyFunction = "Admin." | "HVAC" | "DC" | "F&A" | string;
export type VacancyStatus = "Active" | "On Hold" | "Filled";
export type JDStatus = "Not Started" | "In Progress" | "Finalized";
export type SalaryPeriod = "Per Month" | "Per Annum";
export type ProgressStepStatus = "Not Started" | "In Progress" | "Done";

export type ProgressKey =
    | "jd"
    | "sourcing"
    | "pruning"
    | "enrollmentAndScreening"
    | "coordinationWithCandidates"
    | "coordinationWithHiringManagers"
    | "offer";

export interface VacancyProgressItem {
    status: ProgressStepStatus;
    note: string;
}

export type VacancyProgress = Record<ProgressKey, VacancyProgressItem>;

export interface VacancySearchString {
    keywords: string;
    booleanQuery: string;
    experience: string;
    location: string;
    salary: string;
    departmentAndRole: string;
    industry: string;
    company: string;
    designation: string;
    education: string;
    dAndI: string;
}

export interface ActivityLog {
    id: string;
    entityType: "vacancy" | "candidate";
    entityId: string;
    timestamp: string; // ISO string
    formattedDate: string; // DD.MM.YY
    initials: string;
    authorName: string;
    note: string;
}

export interface Vacancy {
    id: string;
    vacancyCode: string; // VC-001 style
    position: string;
    functionName: VacancyFunction;
    location: string | null;
    startDate: string; // ISO YYYY-MM-DD
    totalVacancies: number;
    remainingVacancies: number;
    reportingTo: string;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryPeriod: SalaryPeriod;
    status: VacancyStatus;
    jdStatus: JDStatus;
    jdFileName: string | null;
    assignedHr: string | null;
    initialRemarks: string | null;
    statusReason?: string | null;
    statusEffectiveDate?: string | null;
    overrideFilledReason?: string | null;
    progress: VacancyProgress;
    searchStrings: VacancySearchString;
    activityLog: ActivityLog[];
    isSample?: boolean;
    createdAt: string;
    updatedAt: string;
}

export type CandidateSource =
    | "Naukri Resdex"
    | "LinkedIn"
    | "Employee Referral"
    | "Website"
    | "Direct Contact"
    | "Walk-in"
    | "Consultant";

// Derived automatically from stage results (Section 6)
export type ScreeningDecision = "Pruning Cleared" | "Pruning Rejected";
export type CallOutcome =
    | "Interested"
    | "Semi Interested"
    | "Call Back"
    | "Not Reachable"
    | "Perpetually Not Reachable"
    | "Not Interested";

export type HrRecommendation = "Shortlist for Technical Interview" | "Hold" | "Reject";
export type TechnicalRecommendation = "Selected for Director Interview" | "Hold" | "Reject";
export type DirectorDecision = "Selected" | "Hold" | "Rejected";
export type OfferResponseStatus = "Accepted" | "Rejected" | "Pending";
export type JoiningOutcomeStatus = "Joined" | "Did Not Join" | "Deferred Joining";
export type ClosureFinalStatus =
    | "Joined"
    | "Rejected"
    | "Offer Declined"
    | "Position Closed"
    | "Did Not Join";

export type CandidateCurrentStatus =
    // Initial / New
    | "New"
    // Screening
    | "Pruning Cleared"
    | "Pruning Rejected"
    | "Interested"
    | "Semi Interested"
    | "Call Back"
    | "Not Reachable"
    | "Perpetually Not Reachable"
    | "Not Interested"
    // HR Interview
    | "Shortlisted"
    | "On Hold"
    | "Rejected"
    // Technical Interview
    | "Selected for Director Interview"
    // Director Interview
    | "Selected"
    // Offer and Joining
    | "Offer Released"
    | "Joined"
    | "Did Not Join"
    | "Deferred Joining"
    // Closed
    | "Offer Declined"
    | "Position Closed";

export type CandidateStageBucket =
    | "Pruning"
    | "Called"
    | "Interested"
    | "HR Shortlisted"
    | "With Team Leader"
    | "With Director"
    | "Selected"
    | "Offered"
    | "Joined"
    | "Rejected"
    | "Closed";

export interface Screening {
    primaryRelevance: number; // 1-5
    secondaryRelevance: number; // 1-5
    overallScore: number; // auto average to 1 decimal
    decision: ScreeningDecision;
    remarks: string;
    rejectionReason?: string | null;
    updatedAt: string;
    updatedBy: string;
}

export interface CallLog {
    id: string;
    candidateId: string;
    callDate: string; // ISO YYYY-MM-DD
    callTime: string; // HH:mm
    outcome: CallOutcome;
    remarks: string;
    callbackDate?: string | null;
    callbackTime?: string | null;
    currentSalary?: number | null;
    expectedSalary?: number | null;
    noticePeriod?: string | null;
    reasonForChange?: string | null;
    loggedBy: string;
    createdAt: string;
}

export type InterviewRound = "HR" | "Technical" | "Director";
export type InterviewMode = "Offline" | "Online (Google Meet / Teams)" | "Telephonic";
export type InterviewStatus =
    | "Scheduled"
    | "Completed"
    | "Rescheduled"
    | "Cancelled"
    | "No Show";

export interface Interview {
    id: string;
    candidateId: string;
    vacancyId: string;
    round: InterviewRound;
    interviewDate: string; // ISO YYYY-MM-DD
    interviewTime: string; // HH:mm
    mode?: InterviewMode; // Primarily HR / all rounds
    interviewer: string; // HR, Team Leader, or Director name
    status: InterviewStatus;
    rescheduleReason?: string | null;
    // Ratings
    overallRating?: number | null; // 1-5 (HR & Director)
    technicalRating?: number | null; // 1-5 (Technical)
    communicationRating?: number | null; // 1-5 (Technical)
    domainKnowledgeRating?: number | null; // 1-5 (Technical)
    // Recommendations / decisions
    hrRecommendation?: HrRecommendation | null;
    technicalRecommendation?: TechnicalRecommendation | null;
    directorDecision?: DirectorDecision | null;
    remarks: string;
    updatedAt: string;
}

export interface Offer {
    candidateId: string;
    offeredPosition: string;
    offeredSalary: number | null;
    joiningDate: string; // ISO YYYY-MM-DD
    offerExpiryDate: string; // ISO YYYY-MM-DD
    hrRemarks: string;
    offerLetterMode: "Generated PDF" | "Uploaded File";
    offerLetterFileName: string | null;
    candidateResponse: OfferResponseStatus;
    releasedAt: string;
}

export interface DocumentChecklistItem {
    key: string;
    label: string;
    submitted: boolean;
    fileName?: string | null;
}

export interface Joining {
    candidateId: string;
    joiningDate: string; // ISO YYYY-MM-DD
    employeeId: string; // auto EMP-###
    department: string; // auto from Vacancy function
    reportingManager: string; // auto from Vacancy reportingTo
    joiningStatus: JoiningOutcomeStatus;
    documentsSubmitted: DocumentChecklistItem[];
    remarks: string;
    updatedAt: string;
}

export type ReferralPaymentStatus = "Pending" | "Approved" | "Paid";

export interface Referral {
    id: string;
    candidateId: string;
    candidateCode: string;
    candidateName: string;
    appliedRole: string;
    referrer: string;
    referralAmount: number | null;
    joiningDate: string | null;
    paymentDueDate: string | null; // Joining Date + 90 days ONLY when Joined
    paymentStatus: ReferralPaymentStatus;
    paymentDate: string | null;
    remarks: string;
    isSample?: boolean;
    updatedAt: string;
}

export interface RecruitmentClosure {
    finalStatus: ClosureFinalStatus;
    closureDate: string; // ISO YYYY-MM-DD
    closedBy: string;
    closingRemarks: string;
}

export interface SentMessageLog {
    id: string;
    candidateId: string;
    channel: "WhatsApp" | "Email";
    templateTitle: string;
    recipient: string;
    body: string;
    sentAt: string;
    sentBy: string;
}

export interface Candidate {
    id: string;
    candidateCode: string; // RC-001 style
    vacancyId: string;
    appliedRole: string;
    source: CandidateSource;
    referrer: string; // Employee name or "N.A."
    startDate: string; // ISO YYYY-MM-DD
    candidateName: string;
    contactNo: string;
    email: string;
    employer: string;
    designation: string;
    companyTurnover: string | null;
    annualSalary: number | null;
    experience: number; // in years
    education: string | null;
    currentLocation: string;
    preferredLocation: string;
    cvFileName: string | null;
    autoFilledFields?: string[];
    initialNote: string | null;
    assignedHr: string;
    currentStatus: CandidateCurrentStatus;
    stageBucket: CandidateStageBucket;
    nextAction: string;
    isClosed: boolean;
    reopenReason?: string | null;
    stepOverrides?: Array<{
        step: number;
        reason: string;
        overriddenBy: string;
        timestamp: string;
    }>;
    screening: Screening | null;
    callLogs: CallLog[];
    interviews: Interview[];
    offer: Offer | null;
    joining: Joining | null;
    closure: RecruitmentClosure | null;
    messagesSent: SentMessageLog[];
    activityLog: ActivityLog[];
    isSample?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface WhatsAppTemplate {
    id: string;
    title: string;
    targetStatus: CandidateCurrentStatus | "General" | "Vacancy On Hold";
    body: string; // Supports {{candidateName}}, {{role}}, {{interviewTime}}, {{amount}}, {{company}}
    isSample?: boolean;
}

export interface TargetCompanyReference {
    id: string;
    companyName: string;
    industry: string;
    typicalRoles: string;
    headquarters: string;
    notes: string;
}

export interface SearchLogReference {
    id: string;
    loggedDate: string;
    vacancyCode: string;
    position: string;
    portal: string;
    booleanString: string;
    profilesFound: number;
    loggedBy: string;
}

// Form payloads
export interface CreateVacancyPayload {
    position: string;
    functionName: VacancyFunction;
    location: string | null;
    startDate: string;
    totalVacancies: number;
    reportingTo: string;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryPeriod: SalaryPeriod;
    status: VacancyStatus;
    jdStatus: JDStatus;
    jdFileName: string | null;
    assignedHr: string | null;
    initialRemarks: string | null;
}

export interface UpdateVacancyPayload extends Partial<CreateVacancyPayload> {
    remainingVacancies?: number;
}

export interface ChangeVacancyStatusPayload {
    vacancyId: string;
    newStatus: VacancyStatus;
    effectiveDate: string;
    reason: string;
    overrideFilledReason?: string;
}

export interface UpdateVacancyProgressPayload {
    vacancyId: string;
    progress: VacancyProgress;
    searchStrings: VacancySearchString;
}

export interface CreateCandidateProfilePayload {
    vacancyId: string;
    source: CandidateSource;
    referrer: string;
    startDate: string;
    candidateName: string;
    contactNo: string;
    email: string;
    employer: string;
    designation: string;
    companyTurnover: string | null;
    annualSalary: number | null;
    experience: number;
    education: string | null;
    currentLocation: string;
    preferredLocation: string;
    cvFileName: string | null;
    autoFilledFields?: string[];
    initialNote: string | null;
    assignedHr?: string;
}

export interface SaveScreeningPayload {
    candidateId: string;
    primaryRelevance: number;
    secondaryRelevance: number;
    decision: ScreeningDecision;
    remarks: string;
    rejectionReason?: string | null;
}

export interface SaveCallLogPayload {
    candidateId: string;
    callDate: string;
    callTime: string;
    outcome: CallOutcome;
    remarks: string;
    callbackDate?: string | null;
    callbackTime?: string | null;
    currentSalary?: number | null;
    expectedSalary?: number | null;
    noticePeriod?: string | null;
    reasonForChange?: string | null;
}

export interface SaveInterviewPayload {
    candidateId: string;
    round: InterviewRound;
    interviewDate: string;
    interviewTime: string;
    mode?: InterviewMode;
    interviewer: string;
    status: InterviewStatus;
    rescheduleReason?: string | null;
    overallRating?: number | null;
    technicalRating?: number | null;
    communicationRating?: number | null;
    domainKnowledgeRating?: number | null;
    hrRecommendation?: HrRecommendation | null;
    technicalRecommendation?: TechnicalRecommendation | null;
    directorDecision?: DirectorDecision | null;
    remarks: string;
    overrideGateReason?: string | null;
}

export interface SaveOfferPayload {
    candidateId: string;
    offeredPosition: string;
    offeredSalary: number | null;
    joiningDate: string;
    offerExpiryDate: string;
    hrRemarks: string;
    offerLetterMode: "Generated PDF" | "Uploaded File";
    offerLetterFileName: string | null;
    candidateResponse: OfferResponseStatus;
    overrideGateReason?: string | null;
}

export interface SaveJoiningPayload {
    candidateId: string;
    joiningDate: string;
    employeeId?: string;
    joiningStatus: JoiningOutcomeStatus;
    documentsSubmitted: DocumentChecklistItem[];
    remarks: string;
    overrideGateReason?: string | null;
}

export interface SaveReferralPayload {
    referralId: string;
    referralAmount: number | null;
    paymentDueDate: string | null;
    paymentStatus: ReferralPaymentStatus;
    paymentDate: string | null;
    remarks: string;
}

export interface SaveClosurePayload {
    candidateId: string;
    finalStatus: ClosureFinalStatus;
    closingRemarks: string;
}
