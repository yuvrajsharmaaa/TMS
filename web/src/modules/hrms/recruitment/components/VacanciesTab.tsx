import { useMemo, useState, type CSSProperties } from "react";
import type { ColDef } from "ag-grid-community";
import { AlertCircle, RotateCcw, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { createActionColumnRenderer } from "@/components/data-grid/renderers/ActionColumnRenderer";
import type { ActionItem } from "@/components/ui/ActionMenu";
import { JD_STATUSES, VACANCY_STATUSES } from "../constants";
import type { Candidate, Vacancy } from "../types";
import {
    calculateDaysOpen,
    formatDdMmYyyy,
    formatSalaryRangeDisplay,
} from "../utils";
import { StatusPill } from "./StatusPill";
import type { VacancyDrawerState } from "./VacancyDrawerForms";

export type VacancyChipFilter = "All" | "Active" | "On Hold" | "Filled" | "JD Pending";

interface VacanciesTabProps {
    vacancies: Vacancy[];
    candidates: Candidate[];
    loading: boolean;
    canManage: boolean;
    search: string;
    onSearchChange: (q: string) => void;
    functionOptions: string[];
    employeeOptions: string[];
    hrOptions: string[];
    onSelectVacancy: (vacancyId: string) => void;
    onOpenDrawer: (state: VacancyDrawerState) => void;
    onAddCandidateForVacancy: (vacancyId: string) => void;
    onFilteredRowsChange?: (rows: Vacancy[]) => void;
}

/**
 * Vacancies Tab (Section 5):
 * - Columns: Vacancy Code, Position, Function, Start Date, Days Open, Seats (filled / total),
 *   Reporting To, Salary Range, Candidates (count in pipeline), Status, JD Status, Assigned HR
 * - Chips with counts: All, Active, On Hold, Filled, JD Pending
 * - Filters: Search Vacancy, Function, Status, JD Status, Reporting To, Assigned HR, Start Date
 * - Row actions: View Vacancy, Edit Vacancy, Change Status, Assign HR, Add Candidate (role pre-selected), Update Progress
 */
export function VacanciesTab({
    vacancies,
    candidates,
    loading,
    canManage,
    search,
    onSearchChange,
    functionOptions,
    employeeOptions,
    hrOptions,
    onSelectVacancy,
    onOpenDrawer,
    onAddCandidateForVacancy,
    onFilteredRowsChange,
}: VacanciesTabProps) {
    const [chip, setChip] = useState<VacancyChipFilter>("All");
    const [fnFilter, setFnFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [jdFilter, setJdFilter] = useState("ALL");
    const [reportingFilter, setReportingFilter] = useState("ALL");
    const [hrFilter, setHrFilter] = useState("ALL");
    const [startDateFilter, setStartDateFilter] = useState("");

    const candidateCountByVacancy = useMemo(() => {
        const map = new Map<string, number>();
        for (const c of candidates) {
            map.set(c.vacancyId, (map.get(c.vacancyId) || 0) + 1);
        }
        return map;
    }, [candidates]);

    const chipCounts = useMemo(
        () => ({
            All: vacancies.length,
            Active: vacancies.filter(v => v.status === "Active").length,
            "On Hold": vacancies.filter(v => v.status === "On Hold").length,
            Filled: vacancies.filter(v => v.status === "Filled").length,
            "JD Pending": vacancies.filter(v => v.jdStatus !== "Finalized").length,
        }),
        [vacancies]
    );

    const zeroRemainingActiveVacancies = useMemo(
        () =>
            vacancies.filter(
                v => v.remainingVacancies === 0 && v.status !== "Filled"
            ),
        [vacancies]
    );

    const filteredVacancies = useMemo(() => {
        const q = search.trim().toLowerCase();
        const result = vacancies.filter(v => {
            if (chip === "Active" && v.status !== "Active") return false;
            if (chip === "On Hold" && v.status !== "On Hold") return false;
            if (chip === "Filled" && v.status !== "Filled") return false;
            if (chip === "JD Pending" && v.jdStatus === "Finalized") return false;

            if (fnFilter !== "ALL" && v.functionName !== fnFilter) return false;
            if (statusFilter !== "ALL" && v.status !== statusFilter) return false;
            if (jdFilter !== "ALL" && v.jdStatus !== jdFilter) return false;
            if (reportingFilter !== "ALL" && v.reportingTo !== reportingFilter) return false;
            if (hrFilter !== "ALL" && (v.assignedHr || "") !== hrFilter) return false;
            if (startDateFilter && v.startDate < startDateFilter) return false;

            if (!q) return true;
            return (
                v.vacancyCode.toLowerCase().includes(q) ||
                v.position.toLowerCase().includes(q) ||
                v.functionName.toLowerCase().includes(q) ||
                (v.location || "").toLowerCase().includes(q) ||
                v.reportingTo.toLowerCase().includes(q) ||
                (v.assignedHr || "").toLowerCase().includes(q) ||
                v.status.toLowerCase().includes(q) ||
                v.jdStatus.toLowerCase().includes(q)
            );
        });
        onFilteredRowsChange?.(result);
        return result;
    }, [
        vacancies,
        chip,
        fnFilter,
        statusFilter,
        jdFilter,
        reportingFilter,
        hrFilter,
        startDateFilter,
        search,
        onFilteredRowsChange,
    ]);

    const rowActions = useMemo<ActionItem<Vacancy>[]>(
        () => [
            {
                label: "View Vacancy",
                onClick: row => onSelectVacancy(row.id),
            },
            {
                label: "Edit Vacancy",
                visible: () => canManage,
                onClick: row => onOpenDrawer({ type: "edit-vacancy", vacancy: row }),
            },
            {
                label: "Change Status",
                visible: () => canManage,
                onClick: row => onOpenDrawer({ type: "change-status", vacancy: row }),
            },
            {
                label: "Assign HR",
                visible: () => canManage,
                onClick: row => onOpenDrawer({ type: "assign-hr", vacancy: row }),
            },
            {
                label: "Add Candidate",
                visible: row =>
                    canManage && row.status === "Active" && row.jdStatus === "Finalized",
                onClick: row => onAddCandidateForVacancy(row.id),
            },
            {
                label: "Update Progress",
                visible: () => canManage,
                onClick: row => onOpenDrawer({ type: "update-progress", vacancy: row }),
            },
        ],
        [canManage, onSelectVacancy, onOpenDrawer, onAddCandidateForVacancy]
    );

    const columns = useMemo<ColDef<Vacancy>[]>(
        () => [
            {
                field: "vacancyCode",
                headerName: "Vacancy Code",
                width: 118,
                minWidth: 105,
                cellClass: "font-mono text-xs font-semibold text-primary",
            },
            {
                field: "position",
                headerName: "Position",
                flex: 1.5,
                minWidth: 180,
                cellRenderer: (p: { data?: Vacancy }) =>
                    p.data ? (
                        <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate font-medium">{p.data.position}</span>
                            {p.data.isSample && (
                                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                    SAMPLE
                                </Badge>
                            )}
                        </div>
                    ) : (
                        "—"
                    ),
            },
            {
                field: "functionName",
                headerName: "Function",
                width: 98,
                minWidth: 90,
                cellRenderer: (p: { value?: string }) =>
                    p.value ? <Badge variant="outline">{p.value}</Badge> : "—",
            },
            {
                field: "startDate",
                headerName: "Start Date",
                width: 112,
                minWidth: 105,
                valueFormatter: p => formatDdMmYyyy(p.value),
            },
            {
                colId: "daysOpen",
                headerName: "Days Open",
                width: 100,
                minWidth: 92,
                valueGetter: p =>
                    p.data ? calculateDaysOpen(p.data.startDate, p.data.status) : 0,
                valueFormatter: p => `${p.value ?? 0}d`,
            },
            {
                colId: "seats",
                headerName: "Seats",
                width: 95,
                minWidth: 88,
                valueGetter: p =>
                    p.data
                        ? `${Math.max(0, p.data.totalVacancies - p.data.remainingVacancies)} / ${p.data.totalVacancies}`
                        : "0 / 0",
                cellStyle: { fontWeight: 600 } as ColDef<Vacancy>["cellStyle"],
            },
            {
                field: "reportingTo",
                headerName: "Reporting To",
                flex: 1.1,
                minWidth: 150,
            },
            {
                colId: "salaryRange",
                headerName: "Salary Range",
                width: 140,
                minWidth: 125,
                valueGetter: p =>
                    p.data
                        ? formatSalaryRangeDisplay(
                              p.data.salaryMin,
                              p.data.salaryMax,
                              p.data.salaryPeriod,
                              p.data.isSample
                          )
                        : "—",
            },
            {
                colId: "candidatesCount",
                headerName: "Candidates",
                width: 105,
                minWidth: 95,
                valueGetter: p =>
                    p.data ? candidateCountByVacancy.get(p.data.id) || 0 : 0,
                cellRenderer: (p: { value?: number }) => (
                    <Badge variant="secondary" className="tabular-nums">
                        {p.value ?? 0}
                    </Badge>
                ),
            },
            {
                field: "status",
                headerName: "Status",
                width: 105,
                minWidth: 95,
                cellRenderer: (p: { value?: string }) => <StatusPill status={p.value} />,
            },
            {
                field: "jdStatus",
                headerName: "JD Status",
                width: 115,
                minWidth: 105,
                cellRenderer: (p: { value?: string }) => <StatusPill status={p.value} />,
            },
            {
                field: "assignedHr",
                headerName: "Assigned HR",
                width: 140,
                minWidth: 125,
                valueFormatter: p => p.value || "Unassigned",
            },
            {
                headerName: "Actions",
                filter: false,
                sortable: false,
                width: 72,
                minWidth: 68,
                maxWidth: 76,
                cellRenderer: createActionColumnRenderer(rowActions),
                cellStyle: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                } as ColDef<Vacancy>["cellStyle"],
            },
        ],
        [candidateCountByVacancy, rowActions]
    );

    const chips: Array<{ key: VacancyChipFilter; label: string }> = [
        { key: "All", label: `All (${chipCounts.All})` },
        { key: "Active", label: `Active (${chipCounts.Active})` },
        { key: "On Hold", label: `On Hold (${chipCounts["On Hold"]})` },
        { key: "Filled", label: `Filled (${chipCounts.Filled})` },
        { key: "JD Pending", label: `JD Pending (${chipCounts["JD Pending"]})` },
    ];

    const hasActiveExtraFilters =
        fnFilter !== "ALL" ||
        statusFilter !== "ALL" ||
        jdFilter !== "ALL" ||
        reportingFilter !== "ALL" ||
        hrFilter !== "ALL" ||
        Boolean(startDateFilter);

    const resetFilters = () => {
        setChip("All");
        setFnFilter("ALL");
        setStatusFilter("ALL");
        setJdFilter("ALL");
        setReportingFilter("ALL");
        setHrFilter("ALL");
        setStartDateFilter("");
        onSearchChange("");
    };

    const gridStyle = { "--ag-cell-horizontal-padding": "8px" } as CSSProperties;

    return (
        <div className="rec-vacancies-tab space-y-3">
            {/* Section 8 Rule: A vacancy at 0 Remaining prompts HR to open Change Status and mark it Filled */}
            {canManage && zeroRemainingActiveVacancies.map(v => (
                <Alert key={v.id}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                            Vacancy <strong>{v.vacancyCode} ({v.position})</strong> has{" "}
                            <strong>0 Remaining seats</strong>. Prompt: open Change Status to mark
                            it Filled.
                        </span>
                        <Button
                            size="sm"
                            onClick={() =>
                                onOpenDrawer({
                                    type: "change-status",
                                    vacancy: v,
                                    presetNewStatus: "Filled",
                                })
                            }
                        >
                            Open Change Status
                        </Button>
                    </AlertDescription>
                </Alert>
            ))}

            {/* Filter Chips + Search Bar (Office Inventory style) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Vacancy status filter chips">
                    {chips.map(c => (
                        <Button
                            key={c.key}
                            type="button"
                            size="sm"
                            variant={
                                chip === c.key
                                    ? c.key === "JD Pending"
                                        ? "destructive"
                                        : "default"
                                    : "outline"
                            }
                            onClick={() => setChip(c.key)}
                        >
                            {c.label}
                        </Button>
                    ))}
                </div>

                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        placeholder="Search Vacancy..."
                        aria-label="Search Vacancy"
                        value={search}
                        onChange={e => onSearchChange(e.target.value)}
                    />
                </div>
            </div>

            {/* Structured Filters Bar (Section 5: Function, Status, JD Status, Reporting To, Assigned HR, Start Date) */}
            <div className="grid grid-cols-2 gap-2.5 rounded-md border bg-muted/20 p-2.5 sm:grid-cols-3 lg:grid-cols-7">
                <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Function</Label>
                    <Select value={fnFilter} onValueChange={setFnFilter}>
                        <SelectTrigger className="h-8 w-full text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Functions</SelectItem>
                            {functionOptions.map(fn => (
                                <SelectItem key={fn} value={fn}>
                                    {fn}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-8 w-full text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Statuses</SelectItem>
                            {VACANCY_STATUSES.map(s => (
                                <SelectItem key={s} value={s}>
                                    {s}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">JD Status</Label>
                    <Select value={jdFilter} onValueChange={setJdFilter}>
                        <SelectTrigger className="h-8 w-full text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All JD Statuses</SelectItem>
                            {JD_STATUSES.map(s => (
                                <SelectItem key={s} value={s}>
                                    {s}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Reporting To</Label>
                    <Select value={reportingFilter} onValueChange={setReportingFilter}>
                        <SelectTrigger className="h-8 w-full text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Managers</SelectItem>
                            {employeeOptions.map(emp => (
                                <SelectItem key={emp} value={emp}>
                                    {emp}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Assigned HR</Label>
                    <Select value={hrFilter} onValueChange={setHrFilter}>
                        <SelectTrigger className="h-8 w-full text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All HR</SelectItem>
                            {hrOptions.map(hr => (
                                <SelectItem key={hr} value={hr}>
                                    {hr}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label htmlFor="rec-vac-filter-date" className="text-[11px] text-muted-foreground">
                        Start Date From
                    </Label>
                    <Input
                        id="rec-vac-filter-date"
                        type="date"
                        className="h-8 text-xs"
                        value={startDateFilter}
                        onChange={e => setStartDateFilter(e.target.value)}
                    />
                </div>

                <div className="flex items-end">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full text-xs"
                        disabled={!hasActiveExtraFilters && chip === "All" && !search}
                        onClick={resetFilters}
                    >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Reset Filters
                    </Button>
                </div>
            </div>

            {/* Vacancies Table (clicking a row opens Vacancy View Page) */}
            <div style={gridStyle}>
                <DataTable
                    data={filteredVacancies}
                    columnDefs={columns}
                    loading={loading}
                    pageSize={25}
                    gridOptions={{
                        rowHeight: 44,
                        headerHeight: 40,
                        onRowClicked: event => {
                            const target = event.event?.target as HTMLElement | null;
                            if (target?.closest("button") || target?.closest("[role='menuitem']")) {
                                return;
                            }
                            if (event.data) {
                                onSelectVacancy(event.data.id);
                            }
                        },
                        rowStyle: { cursor: "pointer" },
                        defaultColDef: {
                            filter: false,
                            sortable: true,
                            resizable: true,
                            cellStyle: { display: "flex", alignItems: "center" },
                        },
                    }}
                />
            </div>
        </div>
    );
}
