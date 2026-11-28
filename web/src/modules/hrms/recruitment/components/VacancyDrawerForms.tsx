import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
    createEmptySearchStrings,
    createEmptyVacancyProgress,
    JD_STATUSES,
    PROGRESS_STEP_STATUSES,
    ROLE_PROGRESS_ITEMS,
    SALARY_PERIODS,
    VACANCY_STATUSES,
} from "../constants";
import type {
    Candidate,
    JDStatus,
    ProgressKey,
    ProgressStepStatus,
    SalaryPeriod,
    Vacancy,
    VacancyProgress,
    VacancySearchString,
    VacancyStatus,
} from "../types";
import type { useRecruitmentMutations } from "../useRecruitment";
import { isPositionUniqueAmongOpenRoles, todayIsoDate } from "../utils";
import { SideDrawerForm } from "./SideDrawerForm";
import { StatusPill } from "./StatusPill";

export type VacancyDrawerState =
    | { type: "closed" }
    | { type: "add-vacancy" }
    | { type: "edit-vacancy"; vacancy: Vacancy }
    | { type: "change-status"; vacancy: Vacancy; presetNewStatus?: VacancyStatus }
    | { type: "assign-hr"; vacancy: Vacancy }
    | { type: "update-progress"; vacancy: Vacancy };

interface VacancyDrawerFormsProps {
    drawer: VacancyDrawerState;
    onClose: () => void;
    vacancies: Vacancy[];
    candidates: Candidate[];
    functionOptions: string[];
    locationOptions: string[];
    employeeOptions: string[];
    hrOptions: string[];
    mutations: ReturnType<typeof useRecruitmentMutations>;
    onSendHoldWhatsApp?: (candidate: Candidate, vacancy: Vacancy) => void;
}

export function VacancyDrawerForms({
    drawer,
    onClose,
    vacancies,
    candidates,
    functionOptions,
    locationOptions,
    employeeOptions,
    hrOptions,
    mutations,
    onSendHoldWhatsApp,
}: VacancyDrawerFormsProps) {
    // --- Add / Edit Vacancy Form State ---
    const [position, setPosition] = useState("");
    const [functionName, setFunctionName] = useState("HVAC");
    const [customFunctionInput, setCustomFunctionInput] = useState("");
    const [showAddFunction, setShowAddFunction] = useState(false);
    const [location, setLocation] = useState<string>("NONE");
    const [startDate, setStartDate] = useState(todayIsoDate());
    const [totalVacancies, setTotalVacancies] = useState("1");
    const [reportingTo, setReportingTo] = useState("");
    const [salaryMin, setSalaryMin] = useState("");
    const [salaryMax, setSalaryMax] = useState("");
    const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriod>("Per Month");
    const [status, setStatus] = useState<VacancyStatus>("Active");
    const [jdStatus, setJdStatus] = useState<JDStatus>("Not Started");
    const [jdFileName, setJdFileName] = useState<string | null>(null);
    const [assignedHr, setAssignedHr] = useState<string>("NONE");
    const [initialRemarks, setInitialRemarks] = useState("");
    const [formError, setFormError] = useState<string | null>(null);

    // --- Change Status Form State ---
    const [newStatus, setNewStatus] = useState<VacancyStatus>("On Hold");
    const [effectiveDate, setEffectiveDate] = useState(todayIsoDate());
    const [statusReason, setStatusReason] = useState("");
    const [overrideFilledReason, setOverrideFilledReason] = useState("");

    // --- Assign HR Form State ---
    const [selectedHr, setSelectedHr] = useState("");

    // --- Update Progress Form State ---
    const [progress, setProgress] = useState<VacancyProgress>(createEmptyVacancyProgress);
    const [searchStrings, setSearchStrings] = useState<VacancySearchString>(
        createEmptySearchStrings
    );

    useEffect(() => {
        setFormError(null);
        if (drawer.type === "add-vacancy") {
            setPosition("");
            setFunctionName(functionOptions[0] || "HVAC");
            setShowAddFunction(false);
            setCustomFunctionInput("");
            setLocation("NONE");
            setStartDate(todayIsoDate());
            setTotalVacancies("1");
            setReportingTo(employeeOptions[0] || "");
            setSalaryMin("");
            setSalaryMax("");
            setSalaryPeriod("Per Month");
            setStatus("Active");
            setJdStatus("Not Started");
            setJdFileName(null);
            setAssignedHr(hrOptions[0] || "NONE");
            setInitialRemarks("");
        } else if (drawer.type === "edit-vacancy") {
            const v = drawer.vacancy;
            setPosition(v.position);
            setFunctionName(v.functionName);
            setShowAddFunction(false);
            setCustomFunctionInput("");
            setLocation(v.location || "NONE");
            setStartDate(v.startDate);
            setTotalVacancies(String(v.totalVacancies));
            setReportingTo(v.reportingTo);
            setSalaryMin(v.salaryMin !== null ? String(v.salaryMin) : "");
            setSalaryMax(v.salaryMax !== null ? String(v.salaryMax) : "");
            setSalaryPeriod(v.salaryPeriod);
            setStatus(v.status);
            setJdStatus(v.jdStatus);
            setJdFileName(v.jdFileName);
            setAssignedHr(v.assignedHr || "NONE");
            setInitialRemarks(v.initialRemarks || "");
        } else if (drawer.type === "change-status") {
            const v = drawer.vacancy;
            const defaultTarget: VacancyStatus =
                drawer.presetNewStatus ||
                (v.status === "Active"
                    ? v.remainingVacancies === 0
                        ? "Filled"
                        : "On Hold"
                    : "Active");
            setNewStatus(defaultTarget);
            setEffectiveDate(todayIsoDate());
            setStatusReason("");
            setOverrideFilledReason("");
        } else if (drawer.type === "assign-hr") {
            setSelectedHr(drawer.vacancy.assignedHr || hrOptions[0] || "");
        } else if (drawer.type === "update-progress") {
            setProgress(structuredClone(drawer.vacancy.progress));
            setSearchStrings(structuredClone(drawer.vacancy.searchStrings));
        }
    }, [drawer, functionOptions, employeeOptions, hrOptions]);

    const editingVacancy =
        drawer.type === "edit-vacancy" ? drawer.vacancy : undefined;

    const computedRemaining = useMemo(() => {
        const tot = Math.max(1, parseInt(totalVacancies, 10) || 1);
        if (!editingVacancy) return tot;
        const filled = Math.max(
            0,
            editingVacancy.totalVacancies - editingVacancy.remainingVacancies
        );
        return Math.max(0, tot - filled);
    }, [totalVacancies, editingVacancy]);

    // Shortlisted candidates who will be messaged when placing a vacancy On Hold (Section 5)
    const shortlistedForOnHoldVacancy = useMemo(() => {
        if (drawer.type !== "change-status") return [];
        const vacId = drawer.vacancy.id;
        return candidates.filter(
            c =>
                c.vacancyId === vacId &&
                !c.isClosed &&
                (c.stageBucket === "HR Shortlisted" ||
                    c.stageBucket === "With Team Leader" ||
                    c.stageBucket === "With Director" ||
                    c.stageBucket === "Selected" ||
                    c.stageBucket === "Offered")
        );
    }, [drawer, candidates]);

    const handleAddCustomFunction = async () => {
        const trimmed = customFunctionInput.trim();
        if (!trimmed) return;
        await mutations.addCustomFunction.mutateAsync(trimmed);
        setFunctionName(trimmed);
        setCustomFunctionInput("");
        setShowAddFunction(false);
    };

    const handleSaveVacancy = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        const trimmedPos = position.trim();
        if (!trimmedPos) {
            setFormError("Position title is required.");
            return;
        }
        if (
            !isPositionUniqueAmongOpenRoles(
                trimmedPos,
                vacancies,
                editingVacancy?.id
            )
        ) {
            setFormError(
                `An open vacancy for "${trimmedPos}" already exists. Position must be unique among open roles.`
            );
            return;
        }

        const totalNum = Number(totalVacancies);
        if (!Number.isInteger(totalNum) || totalNum < 1) {
            setFormError("Total Vacancies must be a whole number of 1 or more.");
            return;
        }

        const minNum = salaryMin.trim() !== "" ? Number(salaryMin) : null;
        const maxNum = salaryMax.trim() !== "" ? Number(salaryMax) : null;
        if (
            minNum !== null &&
            maxNum !== null &&
            (Number.isNaN(minNum) || Number.isNaN(maxNum) || maxNum < minNum)
        ) {
            setFormError("Salary Range Maximum must be greater than or equal to Minimum.");
            return;
        }

        if (!reportingTo) {
            setFormError("Reporting To is required.");
            return;
        }

        const payload = {
            position: trimmedPos,
            functionName,
            location: location === "NONE" ? null : location,
            startDate: startDate || todayIsoDate(),
            totalVacancies: totalNum,
            reportingTo,
            salaryMin: minNum,
            salaryMax: maxNum,
            salaryPeriod,
            status,
            jdStatus,
            jdFileName,
            assignedHr: assignedHr === "NONE" ? null : assignedHr,
            initialRemarks: initialRemarks.trim() || null,
        };

        try {
            if (editingVacancy) {
                await mutations.updateVacancy.mutateAsync({
                    id: editingVacancy.id,
                    data: payload,
                });
            } else {
                await mutations.createVacancy.mutateAsync(payload);
            }
            onClose();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : "Failed to save vacancy");
        }
    };

    const handleSaveStatusChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (drawer.type !== "change-status") return;
        setFormError(null);

        if (!statusReason.trim()) {
            setFormError("Reason is required when changing vacancy status.");
            return;
        }

        if (
            newStatus === "Filled" &&
            drawer.vacancy.remainingVacancies > 0 &&
            !overrideFilledReason.trim()
        ) {
            setFormError(
                `This vacancy still has ${drawer.vacancy.remainingVacancies} remaining seat(s). Please provide an override reason to mark it Filled.`
            );
            return;
        }

        try {
            await mutations.changeVacancyStatus.mutateAsync({
                vacancyId: drawer.vacancy.id,
                newStatus,
                effectiveDate,
                reason: statusReason.trim(),
                overrideFilledReason: overrideFilledReason.trim() || undefined,
            });
            onClose();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : "Failed to change status");
        }
    };

    const handleSaveAssignHr = async (e: React.FormEvent) => {
        e.preventDefault();
        if (drawer.type !== "assign-hr" || !selectedHr) return;
        await mutations.assignVacancyHr.mutateAsync({
            vacancyId: drawer.vacancy.id,
            assignedHr: selectedHr,
        });
        onClose();
    };

    const handleSaveProgress = async (e: React.FormEvent) => {
        e.preventDefault();
        if (drawer.type !== "update-progress") return;
        await mutations.updateVacancyProgress.mutateAsync({
            vacancyId: drawer.vacancy.id,
            progress,
            searchStrings,
        });
        onClose();
    };

    const updateProgressItem = (
        key: ProgressKey,
        field: "status" | "note",
        value: string
    ) => {
        setProgress(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]:
                    field === "status" ? (value as ProgressStepStatus) : value,
            },
        }));
    };

    return (
        <>
            {/* 1. ADD / EDIT VACANCY SIDE DRAWER */}
            <SideDrawerForm
                open={drawer.type === "add-vacancy" || drawer.type === "edit-vacancy"}
                onOpenChange={open => !open && onClose()}
                title={
                    editingVacancy
                        ? `Edit Vacancy (${editingVacancy.vacancyCode})`
                        : "Add New Vacancy"
                }
                description="Create or update a job requisition. Active vacancies with a Finalized JD appear in the Candidate Role dropdown."
                size="lg"
                footer={
                    <div className="flex w-full items-center justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="rec-vacancy-form"
                            disabled={
                                mutations.createVacancy.isPending ||
                                mutations.updateVacancy.isPending
                            }
                        >
                            {editingVacancy ? "Save Vacancy Changes" : "Create Vacancy"}
                        </Button>
                    </div>
                }
            >
                <form id="rec-vacancy-form" onSubmit={handleSaveVacancy} className="space-y-4">
                    {formError && (
                        <Alert variant="destructive">
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="rec-vac-position">
                            Position <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="rec-vac-position"
                            value={position}
                            onChange={e => setPosition(e.target.value)}
                            placeholder="e.g. Site Technician"
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            Exact title; must be unique among open roles.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="rec-vac-function">
                                    Function <span className="text-destructive">*</span>
                                </Label>
                                <button
                                    type="button"
                                    onClick={() => setShowAddFunction(v => !v)}
                                    className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                                >
                                    <Plus className="mr-0.5 h-3 w-3" />
                                    Add Function
                                </button>
                            </div>
                            <Select value={functionName} onValueChange={setFunctionName}>
                                <SelectTrigger id="rec-vac-function" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {functionOptions.map(fn => (
                                        <SelectItem key={fn} value={fn}>
                                            {fn}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {showAddFunction && (
                                <div className="mt-1.5 flex items-center gap-1.5">
                                    <Input
                                        value={customFunctionInput}
                                        onChange={e => setCustomFunctionInput(e.target.value)}
                                        placeholder="New function name..."
                                        className="h-8 text-xs"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={handleAddCustomFunction}
                                    >
                                        Add
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="rec-vac-location">Location (Optional)</Label>
                            <Select value={location} onValueChange={setLocation}>
                                <SelectTrigger id="rec-vac-location" className="w-full">
                                    <SelectValue placeholder="Select location..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NONE">— Not Specified —</SelectItem>
                                    {locationOptions.map(loc => (
                                        <SelectItem key={loc} value={loc}>
                                            {loc}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="rec-vac-start-date">
                                Start Date <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="rec-vac-start-date"
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="rec-vac-total">
                                Total Vacancies <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="rec-vac-total"
                                type="number"
                                min="1"
                                step="1"
                                value={totalVacancies}
                                onChange={e => setTotalVacancies(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Remaining Vacancies (Auto)</Label>
                            <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm font-semibold tabular-nums">
                                {computedRemaining}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="rec-vac-reporting">
                                Reporting To <span className="text-destructive">*</span>
                            </Label>
                            <Select value={reportingTo} onValueChange={setReportingTo}>
                                <SelectTrigger id="rec-vac-reporting" className="w-full">
                                    <SelectValue placeholder="Select manager..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {employeeOptions.map(emp => (
                                        <SelectItem key={emp} value={emp}>
                                            {emp}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="rec-vac-hr">Assigned HR (Optional)</Label>
                            <Select value={assignedHr} onValueChange={setAssignedHr}>
                                <SelectTrigger id="rec-vac-hr" className="w-full">
                                    <SelectValue placeholder="Select HR..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NONE">— Unassigned —</SelectItem>
                                    {hrOptions.map(hr => (
                                        <SelectItem key={hr} value={hr}>
                                            {hr}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="rounded-md border bg-muted/20 p-3 space-y-3">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Salary Range (Optional · Max &gt;= Min)
                        </Label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="space-y-1">
                                <Label htmlFor="rec-vac-sal-min" className="text-xs">
                                    Min Salary (₹)
                                </Label>
                                <Input
                                    id="rec-vac-sal-min"
                                    type="number"
                                    min="0"
                                    value={salaryMin}
                                    onChange={e => setSalaryMin(e.target.value)}
                                    placeholder="[AMOUNT]"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="rec-vac-sal-max" className="text-xs">
                                    Max Salary (₹)
                                </Label>
                                <Input
                                    id="rec-vac-sal-max"
                                    type="number"
                                    min="0"
                                    value={salaryMax}
                                    onChange={e => setSalaryMax(e.target.value)}
                                    placeholder="[AMOUNT]"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="rec-vac-sal-period" className="text-xs">
                                    Period
                                </Label>
                                <Select
                                    value={salaryPeriod}
                                    onValueChange={v => setSalaryPeriod(v as SalaryPeriod)}
                                >
                                    <SelectTrigger id="rec-vac-sal-period" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SALARY_PERIODS.map(p => (
                                            <SelectItem key={p} value={p}>
                                                {p}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="rec-vac-status">Status</Label>
                            <Select
                                value={status}
                                onValueChange={v => setStatus(v as VacancyStatus)}
                            >
                                <SelectTrigger id="rec-vac-status" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {VACANCY_STATUSES.map(s => (
                                        <SelectItem key={s} value={s}>
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="rec-vac-jd-status">JD Status</Label>
                            <Select
                                value={jdStatus}
                                onValueChange={v => setJdStatus(v as JDStatus)}
                            >
                                <SelectTrigger id="rec-vac-jd-status" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {JD_STATUSES.map(s => (
                                        <SelectItem key={s} value={s}>
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="rec-vac-jd-file">Upload JD (Optional)</Label>
                        <Input
                            id="rec-vac-jd-file"
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) setJdFileName(file.name);
                            }}
                        />
                        {jdFileName && (
                            <p className="text-xs text-muted-foreground">
                                Current JD File: <strong className="font-mono">{jdFileName}</strong>
                            </p>
                        )}
                    </div>

                    {!editingVacancy && (
                        <div className="space-y-1.5">
                            <Label htmlFor="rec-vac-remarks">Initial Remarks</Label>
                            <Textarea
                                id="rec-vac-remarks"
                                rows={3}
                                value={initialRemarks}
                                onChange={e => setInitialRemarks(e.target.value)}
                                placeholder="Becomes the first activity log line..."
                            />
                        </div>
                    )}
                </form>
            </SideDrawerForm>

            {/* 2. CHANGE VACANCY STATUS SIDE DRAWER */}
            <SideDrawerForm
                open={drawer.type === "change-status"}
                onOpenChange={open => !open && onClose()}
                title="Change Vacancy Status"
                description={
                    drawer.type === "change-status"
                        ? `${drawer.vacancy.vacancyCode} — ${drawer.vacancy.position}`
                        : ""
                }
                size="md"
                footer={
                    <div className="flex w-full items-center justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="rec-change-status-form"
                            disabled={mutations.changeVacancyStatus.isPending}
                        >
                            Update Vacancy Status
                        </Button>
                    </div>
                }
            >
                {drawer.type === "change-status" && (
                    <form
                        id="rec-change-status-form"
                        onSubmit={handleSaveStatusChange}
                        className="space-y-4"
                    >
                        {formError && (
                            <Alert variant="destructive">
                                <AlertDescription>{formError}</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-3 text-sm">
                            <div>
                                <div className="text-xs text-muted-foreground">Vacancy (Auto)</div>
                                <div className="font-semibold">
                                    {drawer.vacancy.vacancyCode} · {drawer.vacancy.position}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">
                                    Current Status (Auto)
                                </div>
                                <div className="mt-0.5">
                                    <StatusPill status={drawer.vacancy.status} />
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Seats Filled</div>
                                <div className="font-medium tabular-nums">
                                    {drawer.vacancy.totalVacancies -
                                        drawer.vacancy.remainingVacancies}{" "}
                                    / {drawer.vacancy.totalVacancies}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Remaining Seats</div>
                                <div className="font-semibold tabular-nums">
                                    {drawer.vacancy.remainingVacancies}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="rec-new-status">
                                    New Status <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={newStatus}
                                    onValueChange={v => setNewStatus(v as VacancyStatus)}
                                >
                                    <SelectTrigger id="rec-new-status" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {VACANCY_STATUSES.map(s => (
                                            <SelectItem key={s} value={s}>
                                                {s === "Active" && drawer.vacancy.status !== "Active"
                                                    ? "Active (Reopen)"
                                                    : s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="rec-effective-date">
                                    Effective Date <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="rec-effective-date"
                                    type="date"
                                    value={effectiveDate}
                                    onChange={e => setEffectiveDate(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="rec-status-reason">
                                Reason <span className="text-destructive">*</span>
                            </Label>
                            <Textarea
                                id="rec-status-reason"
                                rows={3}
                                value={statusReason}
                                onChange={e => setStatusReason(e.target.value)}
                                placeholder="Provide reason for status change..."
                                required
                            />
                        </div>

                        {newStatus === "On Hold" && (
                            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                                <div className="text-xs font-semibold text-foreground">
                                    On Hold Behaviour:
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    This vacancy will be hidden from the candidate Role dropdown and
                                    referral list while existing pipeline candidates stay visible.
                                </p>
                                <Separator />
                                <div className="text-xs font-medium">
                                    Shortlisted Candidates to Be Messaged (
                                    {shortlistedForOnHoldVacancy.length}):
                                </div>
                                {shortlistedForOnHoldVacancy.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        No shortlisted candidates currently in pipeline for this role.
                                    </p>
                                ) : (
                                    <ul className="divide-y rounded border bg-background text-xs">
                                        {shortlistedForOnHoldVacancy.map(c => (
                                            <li
                                                key={c.id}
                                                className="flex items-center justify-between px-2.5 py-2"
                                            >
                                                <div>
                                                    <span className="font-mono font-semibold">
                                                        {c.candidateCode}
                                                    </span>{" "}
                                                    · {c.candidateName} ({c.contactNo})
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <StatusPill status={c.currentStatus} />
                                                    {onSendHoldWhatsApp && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 px-2 text-xs"
                                                            onClick={() =>
                                                                onSendHoldWhatsApp(
                                                                    c,
                                                                    drawer.vacancy
                                                                )
                                                            }
                                                        >
                                                            Message
                                                        </Button>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {newStatus === "Filled" && drawer.vacancy.remainingVacancies > 0 && (
                            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 space-y-2">
                                <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    {drawer.vacancy.remainingVacancies} Remaining Seat(s) Unfilled —
                                    Override Reason Required
                                </div>
                                <Label htmlFor="rec-override-filled" className="text-xs">
                                    Override Reason <span className="text-destructive">*</span>
                                </Label>
                                <Textarea
                                    id="rec-override-filled"
                                    rows={2}
                                    value={overrideFilledReason}
                                    onChange={e => setOverrideFilledReason(e.target.value)}
                                    placeholder="Explain why the vacancy is being marked Filled with remaining seats..."
                                    required
                                />
                            </div>
                        )}

                        {newStatus === "Filled" && (
                            <p className="text-xs text-muted-foreground">
                                Marking this vacancy <strong>Filled</strong> moves the role and its
                                candidates to the <strong>Filled Archive</strong>.
                            </p>
                        )}
                    </form>
                )}
            </SideDrawerForm>

            {/* 3. ASSIGN HR SIDE DRAWER */}
            <SideDrawerForm
                open={drawer.type === "assign-hr"}
                onOpenChange={open => !open && onClose()}
                title="Assign HR Owner"
                description={
                    drawer.type === "assign-hr"
                        ? `${drawer.vacancy.vacancyCode} — ${drawer.vacancy.position}`
                        : ""
                }
                size="md"
                footer={
                    <div className="flex w-full items-center justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="rec-assign-hr-form"
                            disabled={!selectedHr || mutations.assignVacancyHr.isPending}
                        >
                            Save Assigned HR
                        </Button>
                    </div>
                }
            >
                {drawer.type === "assign-hr" && (
                    <form
                        id="rec-assign-hr-form"
                        onSubmit={handleSaveAssignHr}
                        className="space-y-4"
                    >
                        <div className="space-y-1.5">
                            <Label htmlFor="rec-select-hr">
                                Assigned HR <span className="text-destructive">*</span>
                            </Label>
                            <Select value={selectedHr} onValueChange={setSelectedHr}>
                                <SelectTrigger id="rec-select-hr" className="w-full">
                                    <SelectValue placeholder="Choose HR..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {hrOptions.map(hr => (
                                        <SelectItem key={hr} value={hr}>
                                            {hr}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </form>
                )}
            </SideDrawerForm>

            {/* 4. UPDATE PROGRESS & RESDEX SEARCH STRINGS SIDE DRAWER */}
            <SideDrawerForm
                open={drawer.type === "update-progress"}
                onOpenChange={open => !open && onClose()}
                title={
                    drawer.type === "update-progress"
                        ? `Update Progress — ${drawer.vacancy.vacancyCode} (${drawer.vacancy.position})`
                        : "Update Progress"
                }
                description="Track 7-stage Role Progress and maintain Naukri Resdex search strings."
                size="xl"
                footer={
                    <div className="flex w-full items-center justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="rec-update-progress-form"
                            disabled={mutations.updateVacancyProgress.isPending}
                        >
                            Save Progress &amp; Search Strings
                        </Button>
                    </div>
                }
            >
                {drawer.type === "update-progress" && (
                    <form
                        id="rec-update-progress-form"
                        onSubmit={handleSaveProgress}
                        className="space-y-6"
                    >
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">1. Role Progress</h4>
                                <Badge variant="outline">7 Milestones</Badge>
                            </div>
                            <div className="space-y-2.5">
                                {ROLE_PROGRESS_ITEMS.map(item => (
                                    <div
                                        key={item.key}
                                        className="grid grid-cols-1 gap-2 rounded-md border bg-muted/15 p-3 sm:grid-cols-12 sm:items-center"
                                    >
                                        <div className="sm:col-span-4">
                                            <Label className="text-xs font-semibold">
                                                {item.label}
                                            </Label>
                                        </div>
                                        <div className="sm:col-span-3">
                                            <Select
                                                value={progress[item.key].status}
                                                onValueChange={v =>
                                                    updateProgressItem(item.key, "status", v)
                                                }
                                            >
                                                <SelectTrigger className="h-8 w-full text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PROGRESS_STEP_STATUSES.map(st => (
                                                        <SelectItem key={st} value={st}>
                                                            {st}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="sm:col-span-5">
                                            <Input
                                                className="h-8 text-xs"
                                                value={progress[item.key].note}
                                                onChange={e =>
                                                    updateProgressItem(
                                                        item.key,
                                                        "note",
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="Optional note..."
                                                aria-label={`${item.label} note`}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">
                                    2. Search Strings (Resdex)
                                </h4>
                                <Badge variant="outline">11 Fields</Badge>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="rec-ss-keywords">Keywords</Label>
                                <Input
                                    id="rec-ss-keywords"
                                    value={searchStrings.keywords}
                                    onChange={e =>
                                        setSearchStrings(s => ({
                                            ...s,
                                            keywords: e.target.value,
                                        }))
                                    }
                                    placeholder="Comma-separated keywords"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="rec-ss-boolean">Boolean (Text Area)</Label>
                                <Textarea
                                    id="rec-ss-boolean"
                                    rows={3}
                                    className="font-mono text-xs"
                                    value={searchStrings.booleanQuery}
                                    onChange={e =>
                                        setSearchStrings(s => ({
                                            ...s,
                                            booleanQuery: e.target.value,
                                        }))
                                    }
                                    placeholder='("HVAC" OR "MEP") AND ("Site Engineer")'
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label htmlFor="rec-ss-exp" className="text-xs">
                                        Experience
                                    </Label>
                                    <Input
                                        id="rec-ss-exp"
                                        value={searchStrings.experience}
                                        onChange={e =>
                                            setSearchStrings(s => ({
                                                ...s,
                                                experience: e.target.value,
                                            }))
                                        }
                                        placeholder="e.g. 2 to 5 Years"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="rec-ss-loc" className="text-xs">
                                        Location
                                    </Label>
                                    <Input
                                        id="rec-ss-loc"
                                        value={searchStrings.location}
                                        onChange={e =>
                                            setSearchStrings(s => ({
                                                ...s,
                                                location: e.target.value,
                                            }))
                                        }
                                        placeholder="e.g. Mumbai, Navi Mumbai"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="rec-ss-sal" className="text-xs">
                                        Salary
                                    </Label>
                                    <Input
                                        id="rec-ss-sal"
                                        value={searchStrings.salary}
                                        onChange={e =>
                                            setSearchStrings(s => ({
                                                ...s,
                                                salary: e.target.value,
                                            }))
                                        }
                                        placeholder="[AMOUNT]"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="rec-ss-dept" className="text-xs">
                                        Department and Role
                                    </Label>
                                    <Input
                                        id="rec-ss-dept"
                                        value={searchStrings.departmentAndRole}
                                        onChange={e =>
                                            setSearchStrings(s => ({
                                                ...s,
                                                departmentAndRole: e.target.value,
                                            }))
                                        }
                                        placeholder="e.g. HVAC / Site Execution"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="rec-ss-ind" className="text-xs">
                                        Industry
                                    </Label>
                                    <Input
                                        id="rec-ss-ind"
                                        value={searchStrings.industry}
                                        onChange={e =>
                                            setSearchStrings(s => ({
                                                ...s,
                                                industry: e.target.value,
                                            }))
                                        }
                                        placeholder="e.g. MEP / HVAC / Data Center"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="rec-ss-comp" className="text-xs">
                                        Company
                                    </Label>
                                    <Input
                                        id="rec-ss-comp"
                                        value={searchStrings.company}
                                        onChange={e =>
                                            setSearchStrings(s => ({
                                                ...s,
                                                company: e.target.value,
                                            }))
                                        }
                                        placeholder="Target companies..."
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="rec-ss-desig" className="text-xs">
                                        Designation
                                    </Label>
                                    <Input
                                        id="rec-ss-desig"
                                        value={searchStrings.designation}
                                        onChange={e =>
                                            setSearchStrings(s => ({
                                                ...s,
                                                designation: e.target.value,
                                            }))
                                        }
                                        placeholder="e.g. Site Engineer"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="rec-ss-edu" className="text-xs">
                                        Education
                                    </Label>
                                    <Input
                                        id="rec-ss-edu"
                                        value={searchStrings.education}
                                        onChange={e =>
                                            setSearchStrings(s => ({
                                                ...s,
                                                education: e.target.value,
                                            }))
                                        }
                                        placeholder="e.g. B.E. / Diploma Mechanical"
                                    />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                    <Label htmlFor="rec-ss-dni" className="text-xs">
                                        D&amp;I (Diversity &amp; Inclusion)
                                    </Label>
                                    <Input
                                        id="rec-ss-dni"
                                        value={searchStrings.dAndI}
                                        onChange={e =>
                                            setSearchStrings(s => ({
                                                ...s,
                                                dAndI: e.target.value,
                                            }))
                                        }
                                        placeholder="Diversity hiring notes..."
                                    />
                                </div>
                            </div>
                        </div>
                    </form>
                )}
            </SideDrawerForm>
        </>
    );
}
