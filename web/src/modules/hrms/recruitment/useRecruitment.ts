import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/api/useAuth";
import { useLocations } from "@/hooks/api/useLocations";
import { useUsers } from "@/hooks/api/useUsers";
import {
    recruitmentRepository,
    SAMPLE_EMPLOYEES,
    SAMPLE_LOCATIONS,
} from "./repository";
import type {
    ChangeVacancyStatusPayload,
    CreateCandidateProfilePayload,
    CreateVacancyPayload,
    SaveCallLogPayload,
    SaveClosurePayload,
    SaveInterviewPayload,
    SaveJoiningPayload,
    SaveOfferPayload,
    SaveReferralPayload,
    SaveScreeningPayload,
    UpdateVacancyPayload,
    UpdateVacancyProgressPayload,
} from "./types";

export const RECRUITMENT_QUERY_KEY = ["hrms", "recruitment"] as const;

function getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
}

export function useRecruitmentSnapshot() {
    return useQuery({
        queryKey: [...RECRUITMENT_QUERY_KEY, "snapshot"],
        queryFn: () => recruitmentRepository.getSnapshot(),
        staleTime: 30_000,
    });
}

/**
 * Read-only reuse of Employee list & Location master (Section 3 Step 0 & Section 9),
 * merged with sample fallback records so dropdowns always have rich valid choices.
 */
export function useRecruitmentMasterOptions() {
    const { data: liveUsers = [] } = useUsers();
    const { data: liveLocations = [] } = useLocations();

    const employeeOptions = useMemo(() => {
        const names = new Set<string>();
        for (const emp of SAMPLE_EMPLOYEES) {
            names.add(emp.name);
        }
        for (const u of liveUsers) {
            if (u.name && u.name.trim() && u.name.trim() !== "-") {
                names.add(u.name.trim());
            }
        }
        return Array.from(names);
    }, [liveUsers]);

    const hrOptions = useMemo(() => {
        const hrs = new Set<string>(
            SAMPLE_EMPLOYEES.filter(e => e.role === "HR").map(e => e.name)
        );
        for (const u of liveUsers) {
            const team = (u.team?.name || "").toLowerCase();
            if (team.includes("hr") && u.name) {
                hrs.add(u.name.trim());
            }
        }
        return Array.from(hrs);
    }, [liveUsers]);

    const directorOptions = useMemo(() => {
        const dirs = new Set<string>(
            SAMPLE_EMPLOYEES.filter(e => e.role === "Director").map(e => e.name)
        );
        for (const u of liveUsers) {
            const role = (u.role?.name || "").toLowerCase();
            if ((role.includes("director") || role === "super user") && u.name) {
                dirs.add(u.name.trim());
            }
        }
        return Array.from(dirs);
    }, [liveUsers]);

    const locationOptions = useMemo(() => {
        const locs = new Set<string>(SAMPLE_LOCATIONS);
        for (const l of liveLocations) {
            if (l.name && l.name.trim()) {
                locs.add(l.name.trim());
            }
        }
        return Array.from(locs);
    }, [liveLocations]);

    return {
        employeeOptions,
        hrOptions,
        directorOptions,
        locationOptions,
    };
}

export function useRecruitmentMutations() {
    const qc = useQueryClient();
    const { data: currentUser } = useCurrentUser();
    const authorName =
        currentUser?.name && currentUser.name !== "-"
            ? currentUser.name
            : "Priya Nair (HR)";

    const invalidate = () => qc.invalidateQueries({ queryKey: RECRUITMENT_QUERY_KEY });

    const createVacancy = useMutation({
        mutationFn: (payload: CreateVacancyPayload) =>
            recruitmentRepository.createVacancy(payload, authorName),
        onSuccess: v => {
            toast.success(`Vacancy ${v.vacancyCode} (${v.position}) created`);
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to create vacancy")),
    });

    const updateVacancy = useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateVacancyPayload }) =>
            recruitmentRepository.updateVacancy(id, data, authorName),
        onSuccess: v => {
            toast.success(`Vacancy ${v.vacancyCode} updated`);
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to update vacancy")),
    });

    const changeVacancyStatus = useMutation({
        mutationFn: (payload: ChangeVacancyStatusPayload) =>
            recruitmentRepository.changeVacancyStatus(payload, authorName),
        onSuccess: v => {
            toast.success(`Vacancy ${v.vacancyCode} status changed to ${v.status}`);
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to change vacancy status")),
    });

    const updateVacancyProgress = useMutation({
        mutationFn: (payload: UpdateVacancyProgressPayload) =>
            recruitmentRepository.updateVacancyProgress(payload, authorName),
        onSuccess: v => {
            toast.success(`Progress & search strings updated for ${v.vacancyCode}`);
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to update vacancy progress")),
    });

    const assignVacancyHr = useMutation({
        mutationFn: ({ vacancyId, assignedHr }: { vacancyId: string; assignedHr: string }) =>
            recruitmentRepository.assignVacancyHr(vacancyId, assignedHr, authorName),
        onSuccess: v => {
            toast.success(`Assigned HR updated for ${v.vacancyCode}`);
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to assign HR")),
    });

    const addVacancyNote = useMutation({
        mutationFn: ({ vacancyId, note }: { vacancyId: string; note: string }) =>
            recruitmentRepository.addVacancyNote(vacancyId, note, authorName),
        onSuccess: () => {
            toast.success("Activity log note added");
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to add note")),
    });

    const addCustomFunction = useMutation({
        mutationFn: (functionName: string) =>
            recruitmentRepository.addCustomFunction(functionName),
        onSuccess: () => {
            toast.success("Function added to list");
            invalidate();
        },
    });

    const createCandidate = useMutation({
        mutationFn: (payload: CreateCandidateProfilePayload) =>
            recruitmentRepository.createCandidate(payload, authorName),
        onSuccess: c => {
            toast.success(`Candidate ${c.candidateCode} (${c.candidateName}) enrolled`);
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to add candidate")),
    });

    const updateCandidateProfile = useMutation({
        mutationFn: ({
            id,
            data,
        }: {
            id: string;
            data: Partial<CreateCandidateProfilePayload>;
        }) => recruitmentRepository.updateCandidateProfile(id, data, authorName),
        onSuccess: c => {
            toast.success(`Candidate ${c.candidateCode} updated`);
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to update candidate")),
    });

    const saveScreening = useMutation({
        mutationFn: (payload: SaveScreeningPayload) =>
            recruitmentRepository.saveScreening(payload, authorName),
        onSuccess: c => {
            toast.success(
                `Step 2 Screening saved for ${c.candidateCode} (${c.currentStatus})`
            );
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to save screening")),
    });

    const saveCallLog = useMutation({
        mutationFn: (payload: SaveCallLogPayload) =>
            recruitmentRepository.saveCallLog(payload, authorName),
        onSuccess: c => {
            toast.success(`Step 3 Call outcome saved (${c.currentStatus})`);
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to save call log")),
    });

    const rescheduleCallBack = useMutation({
        mutationFn: ({
            candidateId,
            callbackDate,
            callbackTime,
            reason,
        }: {
            candidateId: string;
            callbackDate: string;
            callbackTime: string;
            reason: string;
        }) =>
            recruitmentRepository.rescheduleCallBack(
                candidateId,
                callbackDate,
                callbackTime,
                reason,
                authorName
            ),
        onSuccess: c => {
            toast.success(`Callback rescheduled for ${c.candidateCode}`);
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to reschedule call")),
    });

    const saveInterview = useMutation({
        mutationFn: (payload: SaveInterviewPayload) =>
            recruitmentRepository.saveInterview(payload, authorName),
        onSuccess: c => {
            toast.success(`Interview updated for ${c.candidateCode}`);
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to save interview")),
    });

    const saveOffer = useMutation({
        mutationFn: (payload: SaveOfferPayload) =>
            recruitmentRepository.saveOffer(payload, authorName),
        onSuccess: c => {
            toast.success(`Offer letter saved for ${c.candidateCode}`);
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to save offer")),
    });

    const saveJoining = useMutation({
        mutationFn: (payload: SaveJoiningPayload) =>
            recruitmentRepository.saveJoining(payload, authorName),
        onSuccess: c => {
            toast.success(`Joining & onboarding updated for ${c.candidateCode}`);
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to save joining details")),
    });

    const saveClosure = useMutation({
        mutationFn: (payload: SaveClosurePayload) =>
            recruitmentRepository.saveClosure(payload, authorName),
        onSuccess: c => {
            toast.success(`Recruitment closed for ${c.candidateCode}`);
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to close recruitment")),
    });

    const reopenCandidate = useMutation({
        mutationFn: ({ candidateId, reason }: { candidateId: string; reason: string }) =>
            recruitmentRepository.reopenCandidate(candidateId, reason, authorName),
        onSuccess: c => {
            toast.success(`Candidate ${c.candidateCode} reopened`);
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to reopen candidate")),
    });

    const logWhatsAppMessage = useMutation({
        mutationFn: ({
            candidateId,
            templateTitle,
            recipient,
            body,
        }: {
            candidateId: string;
            templateTitle: string;
            recipient: string;
            body: string;
        }) =>
            recruitmentRepository.logWhatsAppMessage(
                candidateId,
                templateTitle,
                recipient,
                body,
                authorName
            ),
        onSuccess: () => {
            toast.success("WhatsApp message logged");
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to log WhatsApp message")),
    });

    const addCandidateNote = useMutation({
        mutationFn: ({ candidateId, note }: { candidateId: string; note: string }) =>
            recruitmentRepository.addCandidateNote(candidateId, note, authorName),
        onSuccess: () => {
            toast.success("Activity log note added");
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to add note")),
    });

    const updateReferral = useMutation({
        mutationFn: (payload: SaveReferralPayload) =>
            recruitmentRepository.updateReferral(payload, authorName),
        onSuccess: r => {
            toast.success(`Referral payout updated for ${r.candidateCode}`);
            invalidate();
        },
        onError: e => toast.error(getErrorMessage(e, "Failed to update referral")),
    });

    const resetSampleData = useMutation({
        mutationFn: () => recruitmentRepository.resetToSampleData(),
        onSuccess: () => {
            toast.success("Sample seed data restored");
            invalidate();
        },
    });

    return {
        authorName,
        createVacancy,
        updateVacancy,
        changeVacancyStatus,
        updateVacancyProgress,
        assignVacancyHr,
        addVacancyNote,
        addCustomFunction,
        createCandidate,
        updateCandidateProfile,
        saveScreening,
        saveCallLog,
        rescheduleCallBack,
        saveInterview,
        saveOffer,
        saveJoining,
        saveClosure,
        reopenCandidate,
        logWhatsAppMessage,
        addCandidateNote,
        updateReferral,
        resetSampleData,
    };
}
