import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Plus, RotateCcw, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUser } from "@/hooks/api/useAuth";
import { usePersistentTableState } from "@/hooks/usePersistentTableState";
import { toast } from "sonner";
import { RECRUITMENT_TABS } from "./constants";
import {
    getRecruitmentRolePermissions,
    resolveRecruitmentRole,
    setRecruitmentRoleOverride,
} from "./permissions";
import type { Candidate, RecruitmentRole, RecruitmentTab, Vacancy } from "./types";
import {
    useRecruitmentMasterOptions,
    useRecruitmentMutations,
    useRecruitmentSnapshot,
} from "./useRecruitment";
import {
    buildWaMeUrl,
    calculateDaysOpen,
    downloadRecruitmentCsv,
    formatDdMmYyyy,
    formatSalaryRangeDisplay,
    interpolateWhatsAppTemplate,
} from "./utils";
import { VacanciesTab } from "./components/VacanciesTab";
import {
    VacancyDrawerForms,
    type VacancyDrawerState,
} from "./components/VacancyDrawerForms";
import { VacancyViewPage } from "./components/VacancyViewPage";

export default function RecruitmentPage() {
    const { data: currentUser } = useCurrentUser();
    const [roleOverrideState, setRoleOverrideState] = useState<RecruitmentRole | null>(
        () => resolveRecruitmentRole(currentUser)
    );

    const activeRole = roleOverrideState || resolveRecruitmentRole(currentUser);
    const perms = getRecruitmentRolePermissions(activeRole);

    const {
        activeTab: persistedTab,
        setActiveTab: setPersistedTab,
        search,
        setSearch,
    } = usePersistentTableState<RecruitmentTab>({
        storageKey: "recruitment:table-state",
        defaultTab: "vacancies",
    });

    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab: RecruitmentTab = RECRUITMENT_TABS.some(t => t.key === persistedTab)
        ? persistedTab
        : "vacancies";

    const selectedVacancyId = searchParams.get("vacancy");

    const setSelectedVacancyId = (vacancyId: string | null) => {
        setSearchParams(
            prev => {
                const copy = new URLSearchParams(prev);
                if (vacancyId) {
                    copy.set("vacancy", vacancyId);
                } else {
                    copy.delete("vacancy");
                }
                return copy;
            },
            { replace: true }
        );
    };

    const { data: snapshot, isLoading, error } = useRecruitmentSnapshot();
    const {
        employeeOptions,
        hrOptions,
        locationOptions,
    } = useRecruitmentMasterOptions();
    const mutations = useRecruitmentMutations();

    const [vacancyDrawer, setVacancyDrawer] = useState<VacancyDrawerState>({
        type: "closed",
    });

    const filteredVacanciesRef = useRef<Vacancy[]>([]);

    const vacancies = useMemo(() => snapshot?.vacancies ?? [], [snapshot]);
    const candidates = useMemo(() => snapshot?.candidates ?? [], [snapshot]);
    const referrals = useMemo(() => snapshot?.referrals ?? [], [snapshot]);
    const customFunctions = useMemo(
        () => snapshot?.customFunctions ?? ["Admin.", "HVAC", "DC", "F&A"],
        [snapshot]
    );

    const selectedVacancy = useMemo(
        () => vacancies.find(v => v.id === selectedVacancyId) ?? null,
        [vacancies, selectedVacancyId]
    );

    const candidateCountByVacancy = useMemo(() => {
        const map = new Map<string, number>();
        for (const c of candidates) {
            map.set(c.vacancyId, (map.get(c.vacancyId) || 0) + 1);
        }
        return map;
    }, [candidates]);

    const handleRoleSwitch = (nextRole: RecruitmentRole) => {
        setRecruitmentRoleOverride(nextRole);
        setRoleOverrideState(nextRole);
        toast.info(`Viewing Recruitment Module as ${nextRole}`);
    };

    const handleAddCandidateForVacancy = (vacancyId: string) => {
        setSelectedVacancyId(null);
        setPersistedTab("candidates");
        setSearchParams(
            prev => {
                const copy = new URLSearchParams(prev);
                copy.set("tab", "candidates");
                copy.set("presetVacancyId", vacancyId);
                copy.delete("vacancy");
                return copy;
            },
            { replace: true }
        );
        toast.info("Switched to Candidates tab with role pre-selected (Phase 2 form)");
    };

    const handleNavigateToCandidatesWithFilter = (
        vacancyId: string,
        stageBucket: string
    ) => {
        setSelectedVacancyId(null);
        setPersistedTab("candidates");
        setSearchParams(
            prev => {
                const copy = new URLSearchParams(prev);
                copy.set("tab", "candidates");
                copy.set("filterVacancyId", vacancyId);
                copy.set("filterStage", stageBucket);
                copy.delete("vacancy");
                return copy;
            },
            { replace: true }
        );
    };

    const handleSendHoldWhatsApp = (candidate: Candidate, vacancy: Vacancy) => {
        const holdTemplate =
            snapshot?.whatsappTemplates.find(t => t.targetStatus === "Vacancy On Hold")
                ?.body ||
            "Dear {{candidateName}}, hiring for {{role}} at {{company}} has been temporarily placed on hold. We have retained your shortlisted profile on priority.";
        const text = interpolateWhatsAppTemplate(holdTemplate, {
            candidateName: candidate.candidateName,
            role: vacancy.position,
        });
        mutations.logWhatsAppMessage.mutate({
            candidateId: candidate.id,
            templateTitle: "Vacancy Placed On Hold Update",
            recipient: candidate.contactNo,
            body: text,
        });
        window.open(buildWaMeUrl(candidate.contactNo, text), "_blank", "noopener,noreferrer");
    };

    const handleExportCsv = () => {
        if (activeTab === "vacancies") {
            const rowsToExport =
                filteredVacanciesRef.current.length > 0 || search
                    ? filteredVacanciesRef.current
                    : vacancies;
            downloadRecruitmentCsv(
                "recruitment-vacancies.csv",
                [
                    "Vacancy Code",
                    "Position",
                    "Function",
                    "Location",
                    "Start Date",
                    "Days Open",
                    "Filled Seats",
                    "Total Seats",
                    "Remaining Seats",
                    "Reporting To",
                    "Salary Range",
                    "Candidates in Pipeline",
                    "Status",
                    "JD Status",
                    "Assigned HR",
                ],
                rowsToExport.map(v => [
                    v.vacancyCode,
                    v.position,
                    v.functionName,
                    v.location || "",
                    formatDdMmYyyy(v.startDate),
                    calculateDaysOpen(v.startDate, v.status),
                    Math.max(0, v.totalVacancies - v.remainingVacancies),
                    v.totalVacancies,
                    v.remainingVacancies,
                    v.reportingTo,
                    formatSalaryRangeDisplay(
                        v.salaryMin,
                        v.salaryMax,
                        v.salaryPeriod,
                        v.isSample
                    ),
                    candidateCountByVacancy.get(v.id) || 0,
                    v.status,
                    v.jdStatus,
                    v.assignedHr || "Unassigned",
                ])
            );
            toast.success(`Exported ${rowsToExport.length} vacancy rows to CSV`);
        } else {
            toast.info(`CSV export for ${activeTab} will be enabled as that tab is built`);
        }
    };

    const primaryAction = useMemo(() => {
        if (!perms.isHr) return null;
        if (activeTab === "vacancies") {
            return {
                label: "Add New Vacancy",
                onClick: () => setVacancyDrawer({ type: "add-vacancy" }),
            };
        }
        if (activeTab === "candidates") {
            return {
                label: "Add New Candidate",
                onClick: () =>
                    toast.info("Add New Candidate stepper will be built in Phase 2"),
            };
        }
        return null;
    }, [activeTab, perms.isHr]);

    // Summary totals strip for Leadership / Quick KPI visibility
    const summaryTotals = useMemo(
        () => ({
            activeVacancies: vacancies.filter(v => v.status === "Active").length,
            onHoldVacancies: vacancies.filter(v => v.status === "On Hold").length,
            filledVacancies: vacancies.filter(v => v.status === "Filled").length,
            openSeats: vacancies
                .filter(v => v.status === "Active")
                .reduce((acc, v) => acc + v.remainingVacancies, 0),
            activeCandidates: candidates.filter(c => !c.isClosed).length,
            joinedCandidates: candidates.filter(c => c.currentStatus === "Joined").length,
            referralsCount: referrals.length,
        }),
        [vacancies, candidates, referrals]
    );

    return (
        <Card className="rec-module-card">
            <CardHeader>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>HRMS</span>
                    <span>&gt;</span>
                    <span className="font-medium text-foreground">Recruitment</span>
                    <Badge variant="outline" className="ml-1 text-[10px]">
                        SAMPLE DATA SEEDED
                    </Badge>
                </div>
                <CardTitle>Recruitment Management</CardTitle>
                <CardDescription>
                    Manage job vacancies, candidate pipeline, screening calls, interview feedback,
                    offers, and employee referral payouts in one place.
                </CardDescription>
                <CardAction>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Role Switcher for testing Section 10 role permissions */}
                        <div className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs text-muted-foreground">Role:</span>
                            <Select
                                value={activeRole}
                                onValueChange={v => handleRoleSwitch(v as RecruitmentRole)}
                            >
                                <SelectTrigger
                                    className="h-7 w-32 border-0 bg-transparent px-1.5 text-xs font-semibold shadow-none"
                                    aria-label="Active recruitment role"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="HR">HR (Full Access)</SelectItem>
                                    <SelectItem value="Team Leader">Team Leader</SelectItem>
                                    <SelectItem value="Director">Director</SelectItem>
                                    <SelectItem value="Leadership">
                                        Leadership (View Only)
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => mutations.resetSampleData.mutate()}
                            title="Reset sample seed data to initial state"
                        >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Reset Sample
                        </Button>

                        <Button variant="outline" onClick={handleExportCsv}>
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>

                        {primaryAction && !selectedVacancy && (
                            <Button onClick={primaryAction.onClick}>
                                <Plus className="mr-2 h-4 w-4" />
                                {primaryAction.label}
                            </Button>
                        )}
                    </div>
                </CardAction>
            </CardHeader>

            <CardContent className="space-y-4">
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>
                            Unable to load recruitment data:{" "}
                            {error instanceof Error ? error.message : "Request failed"}
                        </AlertDescription>
                    </Alert>
                )}

                {perms.isLeadership && (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
                        <div className="rounded-md border bg-muted/30 p-2.5">
                            <div className="text-xs text-muted-foreground">Active Roles</div>
                            <div className="text-lg font-bold tabular-nums">
                                {summaryTotals.activeVacancies}
                            </div>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-2.5">
                            <div className="text-xs text-muted-foreground">On Hold Roles</div>
                            <div className="text-lg font-bold tabular-nums">
                                {summaryTotals.onHoldVacancies}
                            </div>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-2.5">
                            <div className="text-xs text-muted-foreground">Filled Roles</div>
                            <div className="text-lg font-bold tabular-nums">
                                {summaryTotals.filledVacancies}
                            </div>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-2.5">
                            <div className="text-xs text-muted-foreground">Open Seats</div>
                            <div className="text-lg font-bold tabular-nums">
                                {summaryTotals.openSeats}
                            </div>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-2.5">
                            <div className="text-xs text-muted-foreground">Active Candidates</div>
                            <div className="text-lg font-bold tabular-nums">
                                {summaryTotals.activeCandidates}
                            </div>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-2.5">
                            <div className="text-xs text-muted-foreground">Total Joined</div>
                            <div className="text-lg font-bold tabular-nums">
                                {summaryTotals.joinedCandidates}
                            </div>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-2.5">
                            <div className="text-xs text-muted-foreground">Referrals</div>
                            <div className="text-lg font-bold tabular-nums">
                                {summaryTotals.referralsCount}
                            </div>
                        </div>
                    </div>
                )}

                <Tabs
                    value={activeTab}
                    onValueChange={v => {
                        setSelectedVacancyId(null);
                        setPersistedTab(v as RecruitmentTab);
                    }}
                    className="w-full"
                >
                    <TabsList className="w-full justify-start overflow-x-auto">
                        {RECRUITMENT_TABS.map(tab => (
                            <TabsTrigger
                                key={tab.key}
                                value={tab.key}
                                className="data-[state=active]:shadow-sm"
                            >
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {/* TAB 1: VACANCIES */}
                    <TabsContent
                        value="vacancies"
                        className="mt-3 data-[state=inactive]:hidden"
                    >
                        {activeTab === "vacancies" && (
                            selectedVacancy ? (
                                <VacancyViewPage
                                    vacancy={selectedVacancy}
                                    candidates={candidates}
                                    canManage={perms.canManageVacancies}
                                    onBack={() => setSelectedVacancyId(null)}
                                    onOpenDrawer={setVacancyDrawer}
                                    onAddCandidateForVacancy={handleAddCandidateForVacancy}
                                    onNavigateToCandidatesWithFilter={
                                        handleNavigateToCandidatesWithFilter
                                    }
                                    onAddNote={note =>
                                        mutations.addVacancyNote.mutate({
                                            vacancyId: selectedVacancy.id,
                                            note,
                                        })
                                    }
                                />
                            ) : (
                                <VacanciesTab
                                    vacancies={vacancies}
                                    candidates={candidates}
                                    loading={isLoading}
                                    canManage={perms.canManageVacancies}
                                    search={search}
                                    onSearchChange={setSearch}
                                    functionOptions={customFunctions}
                                    employeeOptions={employeeOptions}
                                    hrOptions={hrOptions}
                                    onSelectVacancy={id => setSelectedVacancyId(id)}
                                    onOpenDrawer={setVacancyDrawer}
                                    onAddCandidateForVacancy={handleAddCandidateForVacancy}
                                    onFilteredRowsChange={rows => {
                                        filteredVacanciesRef.current = rows;
                                    }}
                                />
                            )
                        )}
                    </TabsContent>

                    {/* PLACEHOLDER TABS FOR PHASES 2, 3, AND 4 */}
                    {RECRUITMENT_TABS.filter(t => t.key !== "vacancies").map(tab => (
                        <TabsContent
                            key={tab.key}
                            value={tab.key}
                            className="mt-3 data-[state=inactive]:hidden"
                        >
                            <div className="rounded-md border border-dashed bg-muted/15 p-8 text-center">
                                <h3 className="text-base font-semibold">{tab.label}</h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Scheduled for upcoming implementation phase:{" "}
                                    {tab.key === "candidates"
                                        ? "Phase 2 (Candidates Dashboard, Stepper Steps 1–3, Duplicate Check, Candidate Detail Page)"
                                        : tab.key === "todays-calls" ||
                                            tab.key === "interviews" ||
                                            tab.key === "referrals"
                                          ? "Phase 3 (Steps 4–10, Today's Calls, Interviews, Referrals)"
                                          : "Phase 4 (WhatsApp Templates, Reference, Filled Archive, Tests)"}
                                </p>
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>

                <VacancyDrawerForms
                    drawer={vacancyDrawer}
                    onClose={() => setVacancyDrawer({ type: "closed" })}
                    vacancies={vacancies}
                    candidates={candidates}
                    functionOptions={customFunctions}
                    locationOptions={locationOptions}
                    employeeOptions={employeeOptions}
                    hrOptions={hrOptions}
                    mutations={mutations}
                    onSendHoldWhatsApp={handleSendHoldWhatsApp}
                />
            </CardContent>
        </Card>
    );
}
