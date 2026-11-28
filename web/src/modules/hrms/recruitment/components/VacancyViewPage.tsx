import { useMemo } from "react";
import {
    AlertCircle,
    ArrowLeft,
    Copy,
    Edit,
    FileText,
    ListChecks,
    RefreshCw,
    UserPlus,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ROLE_PROGRESS_ITEMS, VACANCY_STAGE_BUCKETS } from "../constants";
import type { Candidate, Vacancy } from "../types";
import {
    calculateDaysOpen,
    formatDdMmYyyy,
    formatSalaryRangeDisplay,
} from "../utils";
import { ActivityLogList } from "./ActivityLogList";
import { StatusPill } from "./StatusPill";
import type { VacancyDrawerState } from "./VacancyDrawerForms";

interface VacancyViewPageProps {
    vacancy: Vacancy;
    candidates: Candidate[];
    canManage: boolean;
    onBack: () => void;
    onOpenDrawer: (state: VacancyDrawerState) => void;
    onAddCandidateForVacancy: (vacancyId: string) => void;
    onNavigateToCandidatesWithFilter: (vacancyId: string, stageBucket: string) => void;
    onAddNote: (note: string) => void;
}

/**
 * Vacancy View Page (Section 5):
 * Sections: Vacancy Details, Role Progress, Candidates by stage (Pruning, Called,
 * HR Shortlisted, With Team Leader, With Director, Selected, Offered, Joined, Closed;
 * each count links to the Candidates tab with that filter), Search Strings, Activity Log.
 */
export function VacancyViewPage({
    vacancy,
    candidates,
    canManage,
    onBack,
    onOpenDrawer,
    onAddCandidateForVacancy,
    onNavigateToCandidatesWithFilter,
    onAddNote,
}: VacancyViewPageProps) {
    const vacancyCandidates = useMemo(
        () => candidates.filter(c => c.vacancyId === vacancy.id),
        [candidates, vacancy.id]
    );

    const stageCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const bucket of VACANCY_STAGE_BUCKETS) {
            if (bucket === "Closed") {
                counts[bucket] = vacancyCandidates.filter(
                    c => c.isClosed && c.stageBucket !== "Joined"
                ).length;
            } else if (bucket === "Called") {
                counts[bucket] = vacancyCandidates.filter(
                    c => c.stageBucket === "Called" || c.stageBucket === "Interested"
                ).length;
            } else {
                counts[bucket] = vacancyCandidates.filter(c => c.stageBucket === bucket).length;
            }
        }
        return counts;
    }, [vacancyCandidates]);

    const filledSeats = Math.max(0, vacancy.totalVacancies - vacancy.remainingVacancies);
    const daysOpen = calculateDaysOpen(vacancy.startDate, vacancy.status);
    const canAddCandidate =
        canManage && vacancy.status === "Active" && vacancy.jdStatus === "Finalized";

    return (
        <div className="rec-vacancy-view space-y-4">
            {/* Top Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={onBack}>
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        Back to Vacancies
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-primary">
                                {vacancy.vacancyCode}
                            </span>
                            <h2 className="text-lg font-semibold">{vacancy.position}</h2>
                            <StatusPill status={vacancy.status} />
                            <StatusPill status={`JD: ${vacancy.jdStatus}`} />
                            {vacancy.isSample && (
                                <Badge variant="outline" className="text-[10px]">
                                    SAMPLE
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Function: <strong>{vacancy.functionName}</strong> · Location:{" "}
                            <strong>{vacancy.location || "—"}</strong> · Reporting To:{" "}
                            <strong>{vacancy.reportingTo}</strong>
                        </p>
                    </div>
                </div>

                {canManage && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenDrawer({ type: "edit-vacancy", vacancy })}
                        >
                            <Edit className="mr-1.5 h-4 w-4" />
                            Edit Vacancy
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenDrawer({ type: "update-progress", vacancy })}
                        >
                            <ListChecks className="mr-1.5 h-4 w-4" />
                            Update Progress
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenDrawer({ type: "change-status", vacancy })}
                        >
                            <RefreshCw className="mr-1.5 h-4 w-4" />
                            Change Status
                        </Button>
                        <Button
                            size="sm"
                            disabled={!canAddCandidate}
                            onClick={() => onAddCandidateForVacancy(vacancy.id)}
                            title={
                                canAddCandidate
                                    ? "Add candidate for this role"
                                    : "Only Active vacancies with a Finalized JD can accept candidates"
                            }
                        >
                            <UserPlus className="mr-1.5 h-4 w-4" />
                            Add Candidate
                        </Button>
                    </div>
                )}
            </div>

            {/* Section 8 Rule: A vacancy at 0 Remaining prompts HR to open Change Status and mark it Filled */}
            {canManage && vacancy.remainingVacancies === 0 && vacancy.status !== "Filled" && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                            All seats for <strong>{vacancy.position}</strong> ({vacancy.vacancyCode})
                            are filled (0 Remaining). Would you like to mark this vacancy as{" "}
                            <strong>Filled</strong>?
                        </span>
                        <Button
                            size="sm"
                            onClick={() =>
                                onOpenDrawer({
                                    type: "change-status",
                                    vacancy,
                                    presetNewStatus: "Filled",
                                })
                            }
                        >
                            Mark as Filled
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* 1. Vacancy Details */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">1. Vacancy Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                        <div className="rounded-md border bg-muted/20 p-2.5">
                            <div className="text-xs text-muted-foreground">Start Date</div>
                            <div className="mt-0.5 font-semibold">
                                {formatDdMmYyyy(vacancy.startDate)}
                            </div>
                        </div>
                        <div className="rounded-md border bg-muted/20 p-2.5">
                            <div className="text-xs text-muted-foreground">Days Open</div>
                            <div className="mt-0.5 font-semibold tabular-nums">
                                {daysOpen} {daysOpen === 1 ? "day" : "days"}
                            </div>
                        </div>
                        <div className="rounded-md border bg-muted/20 p-2.5">
                            <div className="text-xs text-muted-foreground">Seats (Filled / Total)</div>
                            <div className="mt-0.5 font-semibold tabular-nums">
                                {filledSeats} / {vacancy.totalVacancies}{" "}
                                <span className="text-xs font-normal text-muted-foreground">
                                    ({vacancy.remainingVacancies} left)
                                </span>
                            </div>
                        </div>
                        <div className="rounded-md border bg-muted/20 p-2.5">
                            <div className="text-xs text-muted-foreground">Salary Range</div>
                            <div className="mt-0.5 font-semibold">
                                {formatSalaryRangeDisplay(
                                    vacancy.salaryMin,
                                    vacancy.salaryMax,
                                    vacancy.salaryPeriod,
                                    vacancy.isSample
                                )}
                            </div>
                        </div>
                        <div className="rounded-md border bg-muted/20 p-2.5">
                            <div className="text-xs text-muted-foreground">Assigned HR</div>
                            <div className="mt-0.5 font-semibold">
                                {vacancy.assignedHr || "Unassigned"}
                            </div>
                        </div>
                        <div className="rounded-md border bg-muted/20 p-2.5">
                            <div className="text-xs text-muted-foreground">JD Document</div>
                            <div className="mt-0.5 flex items-center gap-1 truncate font-medium">
                                {vacancy.jdFileName ? (
                                    <>
                                        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                                        <span className="truncate font-mono text-xs">
                                            {vacancy.jdFileName}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-muted-foreground">Not uploaded</span>
                                )}
                            </div>
                        </div>
                    </div>
                    {vacancy.statusReason && (
                        <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                            <strong>Last Status Reason ({vacancy.status}):</strong>{" "}
                            {vacancy.statusReason}
                            {vacancy.statusEffectiveDate &&
                                ` (Effective: ${formatDdMmYyyy(vacancy.statusEffectiveDate)})`}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 2. Candidates by Stage (clickable counts -> Candidates tab with filter) */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">
                            2. Candidates by Stage ({vacancyCandidates.length} Total)
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">
                            Click any stage card to open Candidates filtered by that stage
                        </span>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-9">
                        {VACANCY_STAGE_BUCKETS.map(bucket => {
                            const count = stageCounts[bucket] ?? 0;
                            return (
                                <button
                                    key={bucket}
                                    type="button"
                                    onClick={() =>
                                        onNavigateToCandidatesWithFilter(vacancy.id, bucket)
                                    }
                                    className="flex flex-col items-center justify-center rounded-md border bg-muted/20 p-2.5 text-center transition-colors hover:border-primary hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                >
                                    <span className="text-xl font-bold tabular-nums text-primary">
                                        {count}
                                    </span>
                                    <span className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground">
                                        {bucket}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* 3. Role Progress & 4. Search Strings side-by-side */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-sm font-semibold">3. Role Progress</CardTitle>
                        {canManage && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => onOpenDrawer({ type: "update-progress", vacancy })}
                            >
                                Edit Progress
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="divide-y rounded-md border">
                            {ROLE_PROGRESS_ITEMS.map(item => {
                                const entry = vacancy.progress[item.key];
                                return (
                                    <div
                                        key={item.key}
                                        className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                                    >
                                        <div>
                                            <div className="font-medium text-foreground">
                                                {item.label}
                                            </div>
                                            {entry?.note && (
                                                <div className="text-muted-foreground">
                                                    {entry.note}
                                                </div>
                                            )}
                                        </div>
                                        <StatusPill status={entry?.status || "Not Started"} />
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-sm font-semibold">
                            4. Search Strings (Resdex)
                        </CardTitle>
                        {vacancy.searchStrings.booleanQuery && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                    navigator.clipboard?.writeText(
                                        vacancy.searchStrings.booleanQuery
                                    );
                                    toast.success("Boolean string copied to clipboard");
                                }}
                            >
                                <Copy className="mr-1.5 h-3.5 w-3.5" />
                                Copy Boolean
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                        <div className="rounded-md border bg-muted/20 p-2.5">
                            <div className="font-semibold text-muted-foreground">
                                Boolean Search String
                            </div>
                            <div className="mt-1 font-mono text-xs break-words">
                                {vacancy.searchStrings.booleanQuery || "—"}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="rounded border p-2">
                                <span className="text-muted-foreground">Keywords:</span>{" "}
                                <strong>{vacancy.searchStrings.keywords || "—"}</strong>
                            </div>
                            <div className="rounded border p-2">
                                <span className="text-muted-foreground">Experience:</span>{" "}
                                <strong>{vacancy.searchStrings.experience || "—"}</strong>
                            </div>
                            <div className="rounded border p-2">
                                <span className="text-muted-foreground">Location:</span>{" "}
                                <strong>{vacancy.searchStrings.location || "—"}</strong>
                            </div>
                            <div className="rounded border p-2">
                                <span className="text-muted-foreground">Salary:</span>{" "}
                                <strong>{vacancy.searchStrings.salary || "—"}</strong>
                            </div>
                            <div className="rounded border p-2">
                                <span className="text-muted-foreground">Dept &amp; Role:</span>{" "}
                                <strong>{vacancy.searchStrings.departmentAndRole || "—"}</strong>
                            </div>
                            <div className="rounded border p-2">
                                <span className="text-muted-foreground">Industry:</span>{" "}
                                <strong>{vacancy.searchStrings.industry || "—"}</strong>
                            </div>
                            <div className="rounded border p-2">
                                <span className="text-muted-foreground">Target Companies:</span>{" "}
                                <strong>{vacancy.searchStrings.company || "—"}</strong>
                            </div>
                            <div className="rounded border p-2">
                                <span className="text-muted-foreground">Designation:</span>{" "}
                                <strong>{vacancy.searchStrings.designation || "—"}</strong>
                            </div>
                            <div className="rounded border p-2">
                                <span className="text-muted-foreground">Education:</span>{" "}
                                <strong>{vacancy.searchStrings.education || "—"}</strong>
                            </div>
                            <div className="rounded border p-2">
                                <span className="text-muted-foreground">D&amp;I:</span>{" "}
                                <strong>{vacancy.searchStrings.dAndI || "—"}</strong>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 5. Activity Log */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">
                        5. Activity Log (Newest First · DD.MM.YY: Initials: Note)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ActivityLogList
                        logs={vacancy.activityLog}
                        canAddNote={canManage}
                        onAddNote={onAddNote}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
