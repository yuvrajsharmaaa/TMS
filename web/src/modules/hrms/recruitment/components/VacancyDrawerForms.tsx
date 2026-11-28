import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { AlertTriangle, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/form/DateInput";
import { FieldWrapper } from "@/components/form/FieldWrapper";
import { NumberInput } from "@/components/form/NumberInput";
import {
    Combobox,
    SelectField,
    type SelectOption,
} from "@/components/form/SelectField";
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
import {
    getVacancySeatSummary,
    isPositionUniqueAmongOpenRoles,
    todayIsoDate,
} from "../utils";
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
    employeeOptions: string[];
    hrOptions: string[];
    mutations: ReturnType<typeof useRecruitmentMutations>;
    onSendHoldWhatsApp?: (candidate: Candidate, vacancy: Vacancy) => void;
}

const VacancyFormSchema = z.object({
    position: z.string().min(1, { message: "Position is required" }),
    functionName: z.string().min(1, { message: "Function is required" }),
    location: z.string().optional(),
    startDate: z.string().min(1, { message: "Start Date is required" }),
    totalVacancies: z.coerce
        .number()
        .int({ message: "Must be a whole number" })
        .min(1, { message: "Must be at least 1" }),
    reportingTo: z.string().min(1, { message: "Reporting To is required" }),
    salaryMin: z.number().nullable().optional(),
    salaryMax: z.number().nullable().optional(),
    salaryPeriod: z.enum(["Per Month", "Per Annum"]),
    status: z.enum(["Active", "On Hold", "Filled"]),
    jdStatus: z.enum(["Not Started", "In Progress", "Finalized"]),
    assignedHr: z.string().optional(),
    initialRemarks: z.string().optional(),
});

type VacancyFormValues = z.infer<typeof VacancyFormSchema>;

const ChangeStatusFormSchema = z.object({
    newStatus: z.enum(["Active", "On Hold", "Filled"]),
    effectiveDate: z.string().min(1, { message: "Effective Date is required" }),
    reason: z.string().min(1, { message: "Reason is required" }),
    overrideFilledReason: z.string().optional(),
});

type ChangeStatusFormValues = z.infer<typeof ChangeStatusFormSchema>;

const AssignHrFormSchema = z.object({
    assignedHr: z.string().min(1, { message: "Assigned HR is required" }),
});

type AssignHrFormValues = z.infer<typeof AssignHrFormSchema>;

export function VacancyDrawerForms({
    drawer,
    onClose,
    vacancies,
    candidates,
    functionOptions,
    employeeOptions,
    hrOptions,
    mutations,
    onSendHoldWhatsApp,
}: VacancyDrawerFormsProps) {
    const [customFunctionInput, setCustomFunctionInput] = useState("");
    const [showAddFunction, setShowAddFunction] = useState(false);
    const [jdFileName, setJdFileName] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    // --- Update Progress Form State ---
    const [progress, setProgress] = useState<VacancyProgress>(createEmptyVacancyProgress);
    const [searchStrings, setSearchStrings] = useState<VacancySearchString>(
        createEmptySearchStrings
    );

    const vacancyForm = useForm<VacancyFormValues>({
        resolver: zodResolver(VacancyFormSchema) as unknown as Resolver<VacancyFormValues>,
        defaultValues: {
            position: "",
            functionName: functionOptions[0] || "HVAC",
            location: "",
            startDate: todayIsoDate(),
            totalVacancies: 1,
            reportingTo: employeeOptions[0] || "",
            salaryMin: null,
            salaryMax: null,
            salaryPeriod: "Per Month",
            status: "Active",
            jdStatus: "Not Started",
            assignedHr: hrOptions[0] || "",
            initialRemarks: "",
        },
    });

    const changeStatusForm = useForm<ChangeStatusFormValues>({
        resolver: zodResolver(ChangeStatusFormSchema) as unknown as Resolver<ChangeStatusFormValues>,
        defaultValues: {
            newStatus: "On Hold",
            effectiveDate: todayIsoDate(),
            reason: "",
            overrideFilledReason: "",
        },
    });

    const assignHrForm = useForm<AssignHrFormValues>({
        resolver: zodResolver(AssignHrFormSchema) as unknown as Resolver<AssignHrFormValues>,
        defaultValues: {
            assignedHr: hrOptions[0] || "",
        },
    });

    const watchedNewStatus = changeStatusForm.watch("newStatus");

    // SelectOption arrays for SelectField / Combobox (TenderForm reference pattern)
    const functionSelectOptions = useMemo<SelectOption[]>(
        () => functionOptions.map(fn => ({ id: fn, name: fn })),
        [functionOptions]
    );
    const employeeSelectOptions = useMemo<SelectOption[]>(
        () => employeeOptions.map(emp => ({ id: emp, name: emp })),
        [employeeOptions]
    );
    const hrSelectOptions = useMemo<SelectOption[]>(
        () => hrOptions.map(hr => ({ id: hr, name: hr })),
        [hrOptions]
    );
    const salaryPeriodOptions = useMemo<SelectOption[]>(
        () => SALARY_PERIODS.map(p => ({ id: p, name: p })),
        []
    );
    const vacancyStatusOptions = useMemo<SelectOption[]>(
        () => VACANCY_STATUSES.map(s => ({ id: s, name: s })),
        []
    );
    const jdStatusOptions = useMemo<SelectOption[]>(
        () => JD_STATUSES.map(s => ({ id: s, name: s })),
        []
    );
    const progressStatusOptions = useMemo<SelectOption[]>(
        () => PROGRESS_STEP_STATUSES.map(st => ({ id: st, name: st })),
        []
    );

    useEffect(() => {
        setFormError(null);
        if (drawer.type === "add-vacancy") {
            setShowAddFunction(false);
            setCustomFunctionInput("");
            setJdFileName(null);
            vacancyForm.reset({
                position: "",
                functionName: functionOptions[0] || "HVAC",
                location: "",
                startDate: todayIsoDate(),
                totalVacancies: 1,
                reportingTo: employeeOptions[0] || "",
                salaryMin: null,
                salaryMax: null,
                salaryPeriod: "Per Month",
                status: "Active",
                jdStatus: "Not Started",
                assignedHr: hrOptions[0] || "",
                initialRemarks: "",
            });
        } else if (drawer.type === "edit-vacancy") {
            const v = drawer.vacancy;
            setShowAddFunction(false);
            setCustomFunctionInput("");
            setJdFileName(v.jdFileName);
            vacancyForm.reset({
                position: v.position,
                functionName: v.functionName,
                location: v.location || "",
                startDate: v.startDate,
                totalVacancies: v.totalVacancies,
                reportingTo: v.reportingTo,
                salaryMin: v.salaryMin,
                salaryMax: v.salaryMax,
                salaryPeriod: v.salaryPeriod,
                status: v.status,
                jdStatus: v.jdStatus,
                assignedHr: v.assignedHr || "",
                initialRemarks: v.initialRemarks || "",
            });
        } else if (drawer.type === "change-status") {
            const v = drawer.vacancy;
            const seatInfo = getVacancySeatSummary(v, candidates);
            const defaultTarget: VacancyStatus =
                drawer.presetNewStatus ||
                (v.status === "Active"
                    ? seatInfo.openSeats === 0
                        ? "Filled"
                        : "On Hold"
                    : "Active");
            changeStatusForm.reset({
                newStatus: defaultTarget,
                effectiveDate: todayIsoDate(),
                reason: "",
                overrideFilledReason: "",
            });
        } else if (drawer.type === "assign-hr") {
            assignHrForm.reset({
                assignedHr: drawer.vacancy.assignedHr || hrOptions[0] || "",
            });
        } else if (drawer.type === "update-progress") {
            setProgress(structuredClone(drawer.vacancy.progress));
            setSearchStrings(structuredClone(drawer.vacancy.searchStrings));
        }
    }, [
        drawer,
        functionOptions,
        employeeOptions,
        hrOptions,
        candidates,
        vacancyForm,
        changeStatusForm,
        assignHrForm,
    ]);

    const editingVacancy =
        drawer.type === "edit-vacancy" ? drawer.vacancy : undefined;

    const changeStatusSeatInfo = useMemo(() => {
        if (drawer.type !== "change-status") {
            return { filledSeats: 0, totalSeats: 0, openSeats: 0 };
        }
        return getVacancySeatSummary(drawer.vacancy, candidates);
    }, [drawer, candidates]);

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
        vacancyForm.setValue("functionName", trimmed, { shouldValidate: true });
        setCustomFunctionInput("");
        setShowAddFunction(false);
    };

    const handleSaveVacancy = async (values: VacancyFormValues) => {
        setFormError(null);

        const trimmedPos = values.position.trim();
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

        const minNum =
            values.salaryMin !== null && values.salaryMin !== undefined
                ? Number(values.salaryMin)
                : null;
        const maxNum =
            values.salaryMax !== null && values.salaryMax !== undefined
                ? Number(values.salaryMax)
                : null;
        if (
            minNum !== null &&
            maxNum !== null &&
            (Number.isNaN(minNum) || Number.isNaN(maxNum) || maxNum < minNum)
        ) {
            setFormError("Salary Range Maximum must be greater than or equal to Minimum.");
            return;
        }

        const payload = {
            position: trimmedPos,
            functionName: values.functionName,
            location: values.location?.trim() ? values.location.trim() : null,
            startDate: values.startDate || todayIsoDate(),
            totalVacancies: Number(values.totalVacancies),
            reportingTo: values.reportingTo,
            salaryMin: minNum,
            salaryMax: maxNum,
            salaryPeriod: values.salaryPeriod as SalaryPeriod,
            status: values.status as VacancyStatus,
            jdStatus: values.jdStatus as JDStatus,
            jdFileName,
            assignedHr: values.assignedHr?.trim() ? values.assignedHr.trim() : null,
            initialRemarks: values.initialRemarks?.trim()
                ? values.initialRemarks.trim()
                : null,
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

    const handleSaveStatusChange = async (values: ChangeStatusFormValues) => {
        if (drawer.type !== "change-status") return;
        setFormError(null);

        if (
            values.newStatus === "Filled" &&
            changeStatusSeatInfo.openSeats > 0 &&
            (!values.overrideFilledReason || !values.overrideFilledReason.trim())
        ) {
            setFormError(
                `This vacancy still has ${changeStatusSeatInfo.openSeats} open seat(s). Please provide an override reason to mark it Filled.`
            );
            return;
        }

        try {
            await mutations.changeVacancyStatus.mutateAsync({
                vacancyId: drawer.vacancy.id,
                newStatus: values.newStatus,
                effectiveDate: values.effectiveDate,
                reason: values.reason.trim(),
                overrideFilledReason: values.overrideFilledReason?.trim() || undefined,
            });
            onClose();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : "Failed to change status");
        }
    };

    const handleSaveAssignHr = async (values: AssignHrFormValues) => {
        if (drawer.type !== "assign-hr" || !values.assignedHr) return;
        await mutations.assignVacancyHr.mutateAsync({
            vacancyId: drawer.vacancy.id,
            assignedHr: values.assignedHr,
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
            {/* 1. ADD / EDIT VACANCY SIDE DRAWER (Uses TenderForm reference components) */}
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
                <Form {...vacancyForm}>
                    <form
                        id="rec-vacancy-form"
                        onSubmit={vacancyForm.handleSubmit(handleSaveVacancy)}
                        className="space-y-4"
                    >
                        {formError && (
                            <Alert variant="destructive">
                                <AlertDescription>{formError}</AlertDescription>
                            </Alert>
                        )}

                        <FieldWrapper<VacancyFormValues, "position">
                            control={vacancyForm.control}
                            name="position"
                            label="Position *"
                            description="Exact title; must be unique among open roles."
                        >
                            {field => (
                                <Input
                                    placeholder="e.g. Site Technician"
                                    {...field}
                                />
                            )}
                        </FieldWrapper>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-start">
                            <div className="space-y-1.5">
                                <SelectField<VacancyFormValues, "functionName">
                                    control={vacancyForm.control}
                                    name="functionName"
                                    label="Function *"
                                    options={functionSelectOptions}
                                    placeholder="Select Function"
                                    valueType="string"
                                />
                                <div className="flex items-center justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddFunction(v => !v)}
                                        className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                                    >
                                        <Plus className="mr-0.5 h-3 w-3" />
                                        Add Function
                                    </button>
                                </div>
                                {showAddFunction && (
                                    <div className="flex items-center gap-1.5">
                                        <Input
                                            value={customFunctionInput}
                                            onChange={e =>
                                                setCustomFunctionInput(e.target.value)
                                            }
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

                            {/* Location — Manual Text Input (Requirement 3) */}
                            <FieldWrapper<VacancyFormValues, "location">
                                control={vacancyForm.control}
                                name="location"
                                label="Location (Optional)"
                            >
                                {field => (
                                    <Input
                                        placeholder="Enter location manually (e.g. Mumbai HO)"
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                    />
                                )}
                            </FieldWrapper>
                        </div>

                        {/* Start Date & Total Vacancies (Requirement 2: Remaining Vacancies removed) */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-start">
                            <FieldWrapper<VacancyFormValues, "startDate">
                                control={vacancyForm.control}
                                name="startDate"
                                label="Start Date *"
                            >
                                {field => (
                                    <DateInput
                                        value={field.value}
                                        onChange={field.onChange}
                                    />
                                )}
                            </FieldWrapper>

                            <FieldWrapper<VacancyFormValues, "totalVacancies">
                                control={vacancyForm.control}
                                name="totalVacancies"
                                label="Total Vacancies *"
                            >
                                {field => (
                                    <NumberInput
                                        step={1}
                                        min={1}
                                        placeholder="1"
                                        value={field.value}
                                        onChange={v => field.onChange(v ?? 1)}
                                    />
                                )}
                            </FieldWrapper>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-start">
                            <SelectField<VacancyFormValues, "reportingTo">
                                control={vacancyForm.control}
                                name="reportingTo"
                                label="Reporting To *"
                                options={employeeSelectOptions}
                                placeholder="Select Reporting Manager"
                                valueType="string"
                            />

                            <SelectField<VacancyFormValues, "assignedHr">
                                control={vacancyForm.control}
                                name="assignedHr"
                                label="Assigned HR (Optional)"
                                options={hrSelectOptions}
                                placeholder="Select Assigned HR"
                                valueType="string"
                            />
                        </div>

                        <div className="rounded-md border bg-muted/20 p-3 space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Salary Range (Optional · Max &gt;= Min)
                            </Label>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 items-start">
                                <FieldWrapper<VacancyFormValues, "salaryMin">
                                    control={vacancyForm.control}
                                    name="salaryMin"
                                    label="Min Salary (₹)"
                                >
                                    {field => (
                                        <NumberInput
                                            step={1000}
                                            placeholder="[AMOUNT]"
                                            value={field.value}
                                            onChange={field.onChange}
                                        />
                                    )}
                                </FieldWrapper>

                                <FieldWrapper<VacancyFormValues, "salaryMax">
                                    control={vacancyForm.control}
                                    name="salaryMax"
                                    label="Max Salary (₹)"
                                >
                                    {field => (
                                        <NumberInput
                                            step={1000}
                                            placeholder="[AMOUNT]"
                                            value={field.value}
                                            onChange={field.onChange}
                                        />
                                    )}
                                </FieldWrapper>

                                <SelectField<VacancyFormValues, "salaryPeriod">
                                    control={vacancyForm.control}
                                    name="salaryPeriod"
                                    label="Period"
                                    options={salaryPeriodOptions}
                                    placeholder="Select Period"
                                    valueType="string"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-start">
                            <SelectField<VacancyFormValues, "status">
                                control={vacancyForm.control}
                                name="status"
                                label="Status"
                                options={vacancyStatusOptions}
                                placeholder="Select Status"
                                valueType="string"
                            />

                            <SelectField<VacancyFormValues, "jdStatus">
                                control={vacancyForm.control}
                                name="jdStatus"
                                label="JD Status"
                                options={jdStatusOptions}
                                placeholder="Select JD Status"
                                valueType="string"
                            />
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
                                    Current JD File:{" "}
                                    <strong className="font-mono">{jdFileName}</strong>
                                </p>
                            )}
                        </div>

                        {!editingVacancy && (
                            <FieldWrapper<VacancyFormValues, "initialRemarks">
                                control={vacancyForm.control}
                                name="initialRemarks"
                                label="Initial Remarks"
                            >
                                {field => (
                                    <Textarea
                                        rows={3}
                                        placeholder="Becomes the first activity log line..."
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                    />
                                )}
                            </FieldWrapper>
                        )}
                    </form>
                </Form>
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
                    <Form {...changeStatusForm}>
                        <form
                            id="rec-change-status-form"
                            onSubmit={changeStatusForm.handleSubmit(handleSaveStatusChange)}
                            className="space-y-4"
                        >
                            {formError && (
                                <Alert variant="destructive">
                                    <AlertDescription>{formError}</AlertDescription>
                                </Alert>
                            )}

                            <div className="grid grid-cols-3 gap-3 rounded-md border bg-muted/20 p-3 text-sm">
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        Vacancy (Auto)
                                    </div>
                                    <div className="font-semibold">
                                        {drawer.vacancy.vacancyCode} ·{" "}
                                        {drawer.vacancy.position}
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
                                    <div className="text-xs text-muted-foreground">
                                        Seats (Filled / Total)
                                    </div>
                                    <div className="font-medium tabular-nums">
                                        {changeStatusSeatInfo.filledSeats} /{" "}
                                        {changeStatusSeatInfo.totalSeats}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-start">
                                <SelectField<ChangeStatusFormValues, "newStatus">
                                    control={changeStatusForm.control}
                                    name="newStatus"
                                    label="New Status *"
                                    options={vacancyStatusOptions}
                                    placeholder="Select Status"
                                    valueType="string"
                                />

                                <FieldWrapper<ChangeStatusFormValues, "effectiveDate">
                                    control={changeStatusForm.control}
                                    name="effectiveDate"
                                    label="Effective Date *"
                                >
                                    {field => (
                                        <DateInput
                                            value={field.value}
                                            onChange={field.onChange}
                                        />
                                    )}
                                </FieldWrapper>
                            </div>

                            <FieldWrapper<ChangeStatusFormValues, "reason">
                                control={changeStatusForm.control}
                                name="reason"
                                label="Reason *"
                            >
                                {field => (
                                    <Textarea
                                        rows={3}
                                        placeholder="Provide reason for status change..."
                                        {...field}
                                    />
                                )}
                            </FieldWrapper>

                            {watchedNewStatus === "On Hold" && (
                                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                                    <div className="text-xs font-semibold text-foreground">
                                        On Hold Behaviour:
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        This vacancy will be hidden from the candidate Role
                                        dropdown and referral list while existing pipeline
                                        candidates stay visible.
                                    </p>
                                    <Separator />
                                    <div className="text-xs font-medium">
                                        Shortlisted Candidates to Be Messaged (
                                        {shortlistedForOnHoldVacancy.length}):
                                    </div>
                                    {shortlistedForOnHoldVacancy.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            No shortlisted candidates currently in pipeline for
                                            this role.
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
                                                        <StatusPill
                                                            status={c.currentStatus}
                                                        />
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

                            {watchedNewStatus === "Filled" &&
                                changeStatusSeatInfo.openSeats > 0 && (
                                    <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
                                            <AlertTriangle className="h-4 w-4" />
                                            {changeStatusSeatInfo.openSeats} Unfilled Seat(s)
                                            — Override Reason Required
                                        </div>
                                        <FieldWrapper<
                                            ChangeStatusFormValues,
                                            "overrideFilledReason"
                                        >
                                            control={changeStatusForm.control}
                                            name="overrideFilledReason"
                                            label="Override Reason *"
                                        >
                                            {field => (
                                                <Textarea
                                                    rows={2}
                                                    placeholder="Explain why the vacancy is being marked Filled with open seats..."
                                                    value={field.value ?? ""}
                                                    onChange={field.onChange}
                                                />
                                            )}
                                        </FieldWrapper>
                                    </div>
                                )}

                            {watchedNewStatus === "Filled" && (
                                <p className="text-xs text-muted-foreground">
                                    Marking this vacancy <strong>Filled</strong> moves the role
                                    and its candidates to the <strong>Filled Archive</strong>.
                                </p>
                            )}
                        </form>
                    </Form>
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
                            disabled={mutations.assignVacancyHr.isPending}
                        >
                            Save Assigned HR
                        </Button>
                    </div>
                }
            >
                {drawer.type === "assign-hr" && (
                    <Form {...assignHrForm}>
                        <form
                            id="rec-assign-hr-form"
                            onSubmit={assignHrForm.handleSubmit(handleSaveAssignHr)}
                            className="space-y-4"
                        >
                            <SelectField<AssignHrFormValues, "assignedHr">
                                control={assignHrForm.control}
                                name="assignedHr"
                                label="Assigned HR *"
                                options={hrSelectOptions}
                                placeholder="Choose HR..."
                                valueType="string"
                            />
                        </form>
                    </Form>
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
                                            <Combobox
                                                value={progress[item.key].status}
                                                onChange={v =>
                                                    v &&
                                                    updateProgressItem(item.key, "status", v)
                                                }
                                                options={progressStatusOptions}
                                                placeholder="Status"
                                            />
                                        </div>
                                        <div className="sm:col-span-5">
                                            <Input
                                                className="h-9 text-xs"
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
