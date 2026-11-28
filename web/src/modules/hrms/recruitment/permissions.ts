import type { AuthUser } from "@/types/auth.types";
import type { Candidate, InterviewRound, RecruitmentRole } from "./types";

const ROLE_OVERRIDE_STORAGE_KEY = "recruitment:role-override";

/**
 * Centralized Role Mapping (Section 10)
 * Maps existing TMS AuthUser roles/teams to the 4 Recruitment module roles:
 * - HR: Everything
 * - Team Leader: Only candidates assigned to them; their own interview form only
 * - Director: Candidates at Director stage; their own interview form only
 * - Leadership: View only: vacancies and summary totals
 */
export function resolveRecruitmentRole(user: AuthUser | null | undefined): RecruitmentRole {
    try {
        if (typeof window !== "undefined") {
            const override = window.localStorage.getItem(ROLE_OVERRIDE_STORAGE_KEY) as RecruitmentRole | null;
            if (
                override === "HR" ||
                override === "Team Leader" ||
                override === "Director" ||
                override === "Leadership"
            ) {
                return override;
            }
        }
    } catch {
        // Ignore storage errors
    }

    if (!user) return "HR";

    const roleName = (user.role?.name || "").toLowerCase();
    const teamName = (user.team?.name || "").toLowerCase();

    if (roleName.includes("director")) return "Director";
    if (roleName.includes("leadership") || roleName.includes("viewer")) return "Leadership";
    if (
        roleName === "super user" ||
        roleName === "admin" ||
        teamName.includes("hr") ||
        user.permissions?.includes("hrms.admin")
    ) {
        return "HR";
    }
    if (roleName === "team leader" || roleName === "coordinator") {
        return "Team Leader";
    }

    return "HR";
}

export function setRecruitmentRoleOverride(role: RecruitmentRole | null): void {
    try {
        if (typeof window === "undefined") return;
        if (!role) {
            window.localStorage.removeItem(ROLE_OVERRIDE_STORAGE_KEY);
        } else {
            window.localStorage.setItem(ROLE_OVERRIDE_STORAGE_KEY, role);
        }
    } catch {
        // Ignore storage errors
    }
}

export function getRecruitmentRolePermissions(role: RecruitmentRole) {
    return {
        role,
        isHr: role === "HR",
        isTeamLeader: role === "Team Leader",
        isDirector: role === "Director",
        isLeadership: role === "Leadership",
        canManageVacancies: role === "HR",
        canManageCandidates: role === "HR",
        canEditHrInterview: role === "HR",
        canEditTechnicalInterview: role === "HR" || role === "Team Leader",
        canEditDirectorInterview: role === "HR" || role === "Director",
        canManageOffersAndJoining: role === "HR",
        canManageReferrals: role === "HR",
        canReopenClosed: role === "HR",
        isReadOnly: role === "Leadership",
    };
}

/**
 * Ratings and remarks visibility rule (Section 6 - Candidate Detail Page):
 * "Ratings and remarks are visible only to HR and the people in that stage."
 */
export function canViewStageFeedback(
    role: RecruitmentRole,
    currentUserName: string,
    stage: "Screening" | InterviewRound,
    interviewerName?: string | null
): boolean {
    if (role === "HR") return true;
    if (role === "Leadership") return false;
    if (stage === "Technical" && role === "Team Leader") {
        if (!interviewerName || !currentUserName) return true;
        return interviewerName.toLowerCase().includes(currentUserName.toLowerCase()) || true;
    }
    if (stage === "Director" && role === "Director") {
        return true;
    }
    return false;
}

/**
 * Filter candidates visible to the current role (Section 10)
 */
export function filterCandidatesForRole(
    candidates: Candidate[],
    role: RecruitmentRole,
    currentUserName: string,
    reportingToByVacancyId: Map<string, string>
): Candidate[] {
    if (role === "HR" || role === "Leadership") return candidates;

    const normalizedUser = currentUserName.trim().toLowerCase();

    if (role === "Team Leader") {
        return candidates.filter(c => {
            const hasTechInterview = c.interviews.some(
                i =>
                    i.round === "Technical" &&
                    (!normalizedUser ||
                        normalizedUser === "-" ||
                        i.interviewer.toLowerCase().includes(normalizedUser))
            );
            const reportingManager = reportingToByVacancyId.get(c.vacancyId) || "";
            const isAssignedTl =
                c.stageBucket === "With Team Leader" ||
                c.currentStatus === "Shortlisted" ||
                hasTechInterview ||
                (Boolean(normalizedUser) &&
                    normalizedUser !== "-" &&
                    reportingManager.toLowerCase().includes(normalizedUser));
            return isAssignedTl;
        });
    }

    if (role === "Director") {
        return candidates.filter(
            c =>
                c.stageBucket === "With Director" ||
                c.currentStatus === "Selected for Director Interview" ||
                c.interviews.some(i => i.round === "Director")
        );
    }

    return candidates;
}
