import { useMemo, useState, type CSSProperties } from "react";
import type { ColDef } from "ag-grid-community";
import { AlertCircle, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { QuickFilter } from "@/components/ui/quick-filter";
import { createActionColumnRenderer } from "@/components/data-grid/renderers/ActionColumnRenderer";
import type { ActionItem } from "@/components/ui/ActionMenu";
import type { Candidate, Vacancy } from "../types";
import {
    calculateDaysOpen,
    formatDdMmYyyy,
    formatSalaryRangeDisplay,
    getVacancySeatSummary,
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
    onSelectVacancy: (vacancyId: string) => void;
    onOpenDrawer: (state: VacancyDrawerState) => void;
    onAddCandidateForVacancy: (vacancyId: string) => void;
    onFilteredRowsChange?: (rows: Vacancy[]) => void;
}

/**
 * Vacancies Tab (Section 5, aligned with TenderListPage reference components & Requirement 4: no extra Filters section):
 * - Columns: Vacancy Code, Position, Function, Start Date, Days Open, Seats (filled / total),
 *   Reporting To, Salary Range, Candidates (count in pipeline), Status, JD Status, Assigned HR
 * - QuickFilter chips with live counts: All, Active, On Hold, Filled, JD Pending
 * - Search box + DataTable with column sorting & filtering
 * - Row actions: View Vacancy, Edit Vacancy, Change Status, Assign HR, Add Candidate (role pre-selected), Update Progress
 */
export function VacanciesTab({
    vacancies,
    candidates,
    loading,
    canManage,
    search,
    onSearchChange,
    onSelectVacancy,
    onOpenDrawer,
    onAddCandidateForVacancy,
    onFilteredRowsChange,
}: VacanciesTabProps) {
    const [chip, setChip] = useState<VacancyChipFilter>("All");

    const candidateCountByVacancy = useMemo(() => {
        const map = new Map<string, number>();
        for (const c of candidates) {
            map.set(c.vacancyId, (map.get(c.vacancyId) || 0) + 1);
        }
        return map;
    }, [candidates]);

    const seatSummaryByVacancy = useMemo(() => {
        const map = new Map<string, { filledSeats: number; totalSeats: number; openSeats: number }>();
        for (const v of vacancies) {
            map.set(v.id, getVacancySeatSummary(v, candidates));
        }
        return map;
    }, [vacancies, candidates]);

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

    const allSeatsFilledActiveVacancies = useMemo(
        () =>
            vacancies.filter(v => {
                const seatInfo = seatSummaryByVacancy.get(v.id);
                return seatInfo && seatInfo.openSeats === 0 && v.status !== "Filled";
            }),
        [vacancies, seatSummaryByVacancy]
    );

    const filteredVacancies = useMemo(() => {
        const q = search.trim().toLowerCase();
        const result = vacancies.filter(v => {
            if (chip === "Active" && v.status !== "Active") return false;
            if (chip === "On Hold" && v.status !== "On Hold") return false;
            if (chip === "Filled" && v.status !== "Filled") return false;
            if (chip === "JD Pending" && v.jdStatus === "Finalized") return false;

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
    }, [vacancies, chip, search, onFilteredRowsChange]);

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
                valueGetter: p => {
                    if (!p.data) return "0 / 0";
                    const seatInfo = seatSummaryByVacancy.get(p.data.id) ?? {
                        filledSeats: 0,
                        totalSeats: p.data.totalVacancies,
                    };
                    return `${seatInfo.filledSeats} / ${seatInfo.totalSeats}`;
                },
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
        [candidateCountByVacancy, seatSummaryByVacancy, rowActions]
    );

    const quickFilterOptions = useMemo(
        () => [
            { value: "All", label: `All (${chipCounts.All})` },
            { value: "Active", label: `Active (${chipCounts.Active})` },
            { value: "On Hold", label: `On Hold (${chipCounts["On Hold"]})` },
            { value: "Filled", label: `Filled (${chipCounts.Filled})` },
            { value: "JD Pending", label: `JD Pending (${chipCounts["JD Pending"]})` },
        ],
        [chipCounts]
    );

    const gridStyle = { "--ag-cell-horizontal-padding": "8px" } as CSSProperties;

    return (
        <div className="rec-vacancies-tab space-y-3">
            {/* Section 8 Rule: A vacancy with all seats filled prompts HR to open Change Status and mark it Filled */}
            {canManage &&
                allSeatsFilledActiveVacancies.map(v => (
                    <Alert key={v.id}>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                                All seats for{" "}
                                <strong>
                                    {v.vacancyCode} ({v.position})
                                </strong>{" "}
                                are filled. Prompt: open Change Status to mark it Filled.
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

            {/* QuickFilter Chips + Search Bar (TenderListPage reference pattern; Filters section removed) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <QuickFilter
                    options={quickFilterOptions}
                    value={chip}
                    onChange={val => setChip(val as VacancyChipFilter)}
                />

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
                            if (
                                target?.closest("button") ||
                                target?.closest("[role='menuitem']")
                            ) {
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
