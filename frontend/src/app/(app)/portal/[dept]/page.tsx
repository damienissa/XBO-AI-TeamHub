"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TiptapEditor } from "@/app/(app)/board/_components/TiptapEditor";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL;

// ---- Types ------------------------------------------------------------------

interface Department {
  id: string;
  slug: string;
  name: string;
}

interface AppConfig {
  ai_team_hourly_rate: number;
}

// ---- Zod Schema -------------------------------------------------------------
// Using z.number() (not coerce) since react-hook-form valueAsNumber handles conversion.
// This keeps output types clean for the zodResolver generic.

const portalSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters").max(500),
    problem_statement: z.unknown().optional(),
    urgency: z
      .number({ error: "Urgency must be a number" })
      .int()
      .min(1, "Urgency must be 1–5")
      .max(5, "Urgency must be 1–5"),
    priority: z.enum(["low", "medium", "high", "critical"]),
    business_impact: z.string().min(1, "Business impact is required"),
    success_criteria: z.string().min(1, "Success criteria is required"),
    due_date: z.string().optional(),
    effort_estimate: z.number().min(0).optional(),
    next_step: z.string().optional(),
    // ROI inputs (ROI-01 field names)
    current_time_cost_hours_per_week: z.number().positive().optional(),
    employees_affected: z.number().positive().optional(),
    avg_hourly_cost: z.number().positive().optional(),
    // Attachment stub
    attachment_filename: z.string().optional(),
    attachment_size_bytes: z.number().int().min(0).optional(),
  })
  .refine(
    (d) => {
      // If any of the three core ROI inputs is provided, all three must be provided
      // to ensure a meaningful ROI can be computed (ROI-06)
      const hasAny =
        d.current_time_cost_hours_per_week !== undefined ||
        d.employees_affected !== undefined ||
        d.avg_hourly_cost !== undefined;
      if (!hasAny) return false; // require at least one ROI group

      const hasAll =
        d.current_time_cost_hours_per_week !== undefined &&
        d.employees_affected !== undefined &&
        d.avg_hourly_cost !== undefined;
      return hasAll;
    },
    {
      message:
        "Hours/week, Employees affected, and Avg hourly cost must all be provided to compute ROI",
      path: ["current_time_cost_hours_per_week"],
    }
  );

type PortalFormValues = z.infer<typeof portalSchema>;

// ---- API helpers ------------------------------------------------------------

async function fetchDepartments(): Promise<Department[]> {
  const res = await fetch(`${API}/api/departments`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch departments");
  return res.json();
}

async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${API}/api/config`);
  if (!res.ok) throw new Error("Failed to fetch config");
  return res.json();
}

// ---- Section wrapper --------------------------------------------------------

function FormSection({
  title,
  children,
  note,
}: {
  title: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        {note && <p className="text-xs text-slate-500 mt-0.5">{note}</p>}
      </div>
      {children}
    </div>
  );
}

// ---- Field wrapper ----------------------------------------------------------

function FieldRow({
  label,
  htmlFor,
  children,
  error,
  required,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ---- Main component ---------------------------------------------------------

export default function PortalDeptPage() {
  const params = useParams<{ dept: string }>();
  const router = useRouter();
  const deptSlug = params.dept;

  const [submitted, setSubmitted] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
    staleTime: 300_000,
  });

  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: fetchConfig,
    staleTime: 300_000,
  });

  const hourlyRate = config?.ai_team_hourly_rate ?? 75;

  const dept = departments?.find((d) => d.slug === deptSlug);
  const deptName = dept?.name ?? deptSlug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PortalFormValues>({
    resolver: zodResolver(portalSchema),
    defaultValues: {
      urgency: 3,
      priority: "medium",
    },
  });

  // Live ROI calculation preview from Row 1 core inputs
  const hoursPerWeek = watch("current_time_cost_hours_per_week") ?? 0;
  const employeesAffected = watch("employees_affected") ?? 0;
  const avgHourlyCost = watch("avg_hourly_cost") ?? 0;
  const liveWeeklyCost = hoursPerWeek * employeesAffected * avgHourlyCost;
  const liveYearlyCost = liveWeeklyCost * 52;
  const liveAnnualSavings = liveYearlyCost;

  const submitMutation = useMutation({
    mutationFn: async (data: PortalFormValues) => {
      if (!dept?.id) throw new Error("Department not found");

      const payload = {
        title: data.title,
        department_id: dept.id,
        problem_statement: data.problem_statement ?? null,
        urgency: data.urgency,
        priority: data.priority,
        business_impact: data.business_impact,
        success_criteria: data.success_criteria,
        due_date: data.due_date || null,
        effort_estimate: data.effort_estimate ?? null,
        next_step: data.next_step || null,
        // ROI-01 field names
        current_time_cost_hours_per_week: data.current_time_cost_hours_per_week ?? null,
        employees_affected: data.employees_affected ?? null,
        avg_hourly_cost: data.avg_hourly_cost ?? null,
        attachment_filename: data.attachment_filename || null,
        attachment_size_bytes: data.attachment_size_bytes ?? null,
      };

      const res = await fetch(`${API}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? "Submission failed");
      }

      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const onSubmit = (data: PortalFormValues) => {
    submitMutation.mutate(data);
  };

  // ---- Success state --------------------------------------------------------

  if (submitted) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex flex-col items-center text-center py-16 space-y-4">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-9 w-9 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Request submitted successfully!</h1>
          <p className="text-slate-500 max-w-md">
            Your request has been added to the team board. The AI team will review and prioritise
            it shortly.
          </p>
          <div className="flex gap-3 pt-2">
            <Button asChild variant="default">
              <Link href="/board">View on board &rarr;</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/portal">Submit another request</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Form ----------------------------------------------------------------

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Back nav */}
      <div className="mb-6">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portal
        </Link>
      </div>

      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          New Request &mdash; {deptName}
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Fill in all required fields. ROI Row 1 (hours, employees, cost) must all be provided before submitting.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* Section 1: Request Details */}
        <FormSection title="Request Details">
          <FieldRow label="Title" htmlFor="title" error={errors.title?.message} required>
            <Input
              id="title"
              placeholder="Short, descriptive title for this request"
              {...register("title")}
              className={cn(errors.title && "border-red-400 focus-visible:ring-red-400")}
            />
          </FieldRow>

          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Urgency (1–5)" htmlFor="urgency" error={errors.urgency?.message} required>
              <Input
                id="urgency"
                type="number"
                min={1}
                max={5}
                placeholder="3"
                {...register("urgency", { valueAsNumber: true })}
                className={cn(errors.urgency && "border-red-400 focus-visible:ring-red-400")}
              />
            </FieldRow>

            <FieldRow label="Priority" htmlFor="priority" error={errors.priority?.message} required>
              <select
                id="priority"
                {...register("priority")}
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  errors.priority && "border-red-400 focus-visible:ring-red-400"
                )}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </FieldRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Due Date" htmlFor="due_date" error={errors.due_date?.message}>
              <Input
                id="due_date"
                type="date"
                {...register("due_date")}
              />
            </FieldRow>

            <FieldRow label="Effort Estimate (hours)" htmlFor="effort_estimate" error={errors.effort_estimate?.message}>
              <Input
                id="effort_estimate"
                type="number"
                min={0}
                step={0.5}
                placeholder="e.g. 8"
                {...register("effort_estimate", { valueAsNumber: true })}
              />
            </FieldRow>
          </div>
        </FormSection>

        {/* Section 2: Problem Description */}
        <FormSection title="Problem Description">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Problem Statement
            </Label>
            <Controller
              name="problem_statement"
              control={control}
              render={({ field }) => (
                <TiptapEditor
                  initialContent={field.value ?? null}
                  onSave={(json) => field.onChange(json)}
                />
              )}
            />
          </div>

          <FieldRow
            label="Business Impact"
            htmlFor="business_impact"
            error={errors.business_impact?.message}
            required
          >
            <textarea
              id="business_impact"
              rows={3}
              placeholder="What is the business impact of this problem?"
              {...register("business_impact")}
              className={cn(
                "w-full text-sm border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-slate-400",
                errors.business_impact && "border-red-400 focus:ring-red-400"
              )}
            />
          </FieldRow>

          <FieldRow
            label="Success Criteria"
            htmlFor="success_criteria"
            error={errors.success_criteria?.message}
            required
          >
            <textarea
              id="success_criteria"
              rows={3}
              placeholder="How do we know this request is complete?"
              {...register("success_criteria")}
              className={cn(
                "w-full text-sm border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-slate-400",
                errors.success_criteria && "border-red-400 focus:ring-red-400"
              )}
            />
          </FieldRow>

          <FieldRow label="Next Step" htmlFor="next_step" error={errors.next_step?.message}>
            <textarea
              id="next_step"
              rows={2}
              placeholder="What is the immediate next action?"
              {...register("next_step")}
              className="w-full text-sm border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-slate-400"
            />
          </FieldRow>
        </FormSection>

        {/* Section 3: ROI Information */}
        <FormSection
          title="ROI Information"
          note="Row 1 (Hours/week, Employees affected, Avg hourly cost) must all be provided. Row 2 fields are optional."
        >
          {/* Row 1: Core cost inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FieldRow
              label="Hours saved / week"
              htmlFor="current_time_cost_hours_per_week"
              error={errors.current_time_cost_hours_per_week?.message}
              required
            >
              <Input
                id="current_time_cost_hours_per_week"
                type="number"
                min={0}
                step={0.5}
                placeholder="e.g. 2"
                {...register("current_time_cost_hours_per_week", { valueAsNumber: true })}
                className={cn(
                  errors.current_time_cost_hours_per_week && "border-red-400 focus-visible:ring-red-400"
                )}
              />
            </FieldRow>

            <FieldRow
              label="Employees affected"
              htmlFor="employees_affected"
              error={errors.employees_affected?.message}
              required
            >
              <Input
                id="employees_affected"
                type="number"
                min={1}
                step={1}
                placeholder="e.g. 10"
                {...register("employees_affected", { valueAsNumber: true })}
                className={cn(errors.employees_affected && "border-red-400 focus-visible:ring-red-400")}
              />
            </FieldRow>

            <FieldRow
              label="Avg hourly cost ($)"
              htmlFor="avg_hourly_cost"
              error={errors.avg_hourly_cost?.message}
              required
            >
              <Input
                id="avg_hourly_cost"
                type="number"
                min={0}
                step={0.01}
                placeholder="e.g. 50"
                {...register("avg_hourly_cost", { valueAsNumber: true })}
                className={cn(errors.avg_hourly_cost && "border-red-400 focus-visible:ring-red-400")}
              />
            </FieldRow>
          </div>

          {/* Live ROI preview */}
          <div
            className={cn(
              "rounded-lg border px-4 py-3 transition-colors",
              liveAnnualSavings > 0
                ? "border-green-200 bg-green-50"
                : "border-slate-200 bg-slate-50"
            )}
          >
            <p className="text-sm text-slate-600">
              Estimated annual savings:{" "}
              <strong
                className={cn(
                  "text-base",
                  liveAnnualSavings > 0 ? "text-green-700" : "text-slate-500"
                )}
              >
                ${liveAnnualSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </strong>
              {liveWeeklyCost > 0 && (
                <span className="text-xs text-slate-400 ml-2">
                  (weekly cost: ${liveWeeklyCost.toLocaleString("en-US", { maximumFractionDigits: 0 })},
                  {" "}yearly: ${liveYearlyCost.toLocaleString("en-US", { maximumFractionDigits: 0 })})
                </span>
              )}
              {liveWeeklyCost === 0 && (
                <span className="text-xs text-slate-400 ml-2">
                  Fill in Row 1 fields to see estimate
                </span>
              )}
            </p>
          </div>
        </FormSection>

        {/* Section 4: Attachment (Optional) */}
        <FormSection title="Attachment (Optional)">
          <div className="grid grid-cols-2 gap-4">
            <FieldRow
              label="Filename"
              htmlFor="attachment_filename"
              error={errors.attachment_filename?.message}
            >
              <Input
                id="attachment_filename"
                placeholder="e.g. requirements.pdf"
                {...register("attachment_filename")}
              />
            </FieldRow>

            <FieldRow
              label="File size (bytes)"
              htmlFor="attachment_size_bytes"
              error={errors.attachment_size_bytes?.message}
            >
              <Input
                id="attachment_size_bytes"
                type="number"
                min={0}
                placeholder="0"
                {...register("attachment_size_bytes", { valueAsNumber: true })}
              />
            </FieldRow>
          </div>
        </FormSection>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/portal")}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={isSubmitting || submitMutation.isPending}
            className="min-w-[140px]"
          >
            {submitMutation.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </div>

        {/* Global submit error */}
        {submitMutation.isError && (
          <p className="text-sm text-red-500 text-right">
            {submitMutation.error instanceof Error
              ? submitMutation.error.message
              : "Submission failed. Please try again."}
          </p>
        )}
      </form>
    </div>
  );
}
