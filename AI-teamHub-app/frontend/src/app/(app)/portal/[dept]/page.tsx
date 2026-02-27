"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Loader2, Paperclip, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { useAiEnabled } from "@/hooks/useAiEnabled";
import { extractFields, fetchEffortEstimate } from "@/lib/api/ai";
import { useToast } from "@/hooks/use-toast";
import { TiptapEditor } from "@/app/(app)/board/_components/TiptapEditor";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Department { id: string; slug: string; name: string; }

// ── Design tokens ────────────────────────────────────────────────────────────

const CARD = {
  background: "#FFFFFF",
  border: "1px solid #E9E9E6",
  borderRadius: "0.75rem",
  padding: "1.5rem",
} as const;

const INPUT_STYLE = {
  background: "#FFFFFF",
  border: "1px solid #E9E9E6",
  color: "#37352F",
  borderRadius: "0.5rem",
  padding: "0.625rem 0.75rem",
  fontSize: "0.875rem",
  width: "100%",
  outline: "none",
  transition: "border-color 0.15s",
} as const;

const LABEL_STYLE = {
  display: "block",
  fontSize: "0.7rem",
  fontFamily: "'JetBrains Mono', monospace",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#9B9A97",
  marginBottom: "0.375rem",
} as const;

// ── Schema ───────────────────────────────────────────────────────────────────

const portalSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(500),
  problem_statement: z.unknown().optional(),
  urgency: z.number({ error: "Urgency must be a number" }).int().min(1).max(5),
  priority: z.enum(["low", "medium", "high", "critical"]),
  business_impact: z.string().min(1, "Business impact is required"),
  success_criteria: z.string().min(1, "Success criteria is required"),
  due_date: z.string().optional(),
  effort_estimate: z.number().min(0).optional(),
  next_step: z.string().optional(),
  current_time_cost_hours_per_week: z.number().positive().optional(),
  employees_affected: z.number().positive().optional(),
  avg_hourly_cost: z.number().positive().optional(),
}).refine(
  (d) => {
    const hasAny = d.current_time_cost_hours_per_week !== undefined || d.employees_affected !== undefined || d.avg_hourly_cost !== undefined;
    if (!hasAny) return false;
    return d.current_time_cost_hours_per_week !== undefined && d.employees_affected !== undefined && d.avg_hourly_cost !== undefined;
  },
  {
    message: "Hours/week, Employees affected, and Avg hourly cost must all be provided",
    path: ["current_time_cost_hours_per_week"],
  }
);

type PortalFormValues = z.infer<typeof portalSchema>;

async function fetchDepartments(): Promise<Department[]> {
  const res = await fetch(`${API}/api/departments`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch departments");
  return res.json();
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={CARD}>
      <div className="mb-5">
        <h2
          className="font-display font-semibold text-base tracking-tight"
          style={{ color: "#37352F" }}
        >
          {title}
        </h2>
        {note && (
          <p className="text-xs mt-1" style={{ color: "#9B9A97" }}>
            {note}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label, htmlFor, children, error, required,
}: { label: string; htmlFor: string; children: React.ReactNode; error?: string; required?: boolean }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} style={LABEL_STYLE}>
        {label}
        {required && <span style={{ color: "#E03E3E", marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs mt-1" style={{ color: "#E03E3E" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function PortalDeptPage() {
  const params = useParams<{ dept: string }>();
  const router = useRouter();
  const deptSlug = params.dept;

  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
    staleTime: 300_000,
  });

  const dept = departments?.find((d) => d.slug === deptSlug);
  const deptName = dept?.name ?? deptSlug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<PortalFormValues>({
    resolver: zodResolver(portalSchema),
    defaultValues: { urgency: 3, priority: "medium" },
  });

  const hoursPerWeek = watch("current_time_cost_hours_per_week") ?? 0;
  const employeesAffected = watch("employees_affected") ?? 0;
  const avgHourlyCost = watch("avg_hourly_cost") ?? 0;
  const liveAnnualSavings = hoursPerWeek * employeesAffected * avgHourlyCost * 52;
  const liveWeeklyCost = hoursPerWeek * employeesAffected * avgHourlyCost;
  const liveYearlyCost = liveWeeklyCost * 52;

  const aiEnabled = useAiEnabled();
  const { toast } = useToast();
  const [effortSuggestion, setEffortSuggestion] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileContext, setFileContext] = useState<string | null>(null);

  const extractMutation = useMutation({
    mutationFn: (file: File) => extractFields(file),
    onSuccess: (data) => {
      if (data.title) setValue("title", data.title, { shouldValidate: true });
      if (data.problem_statement) setValue("problem_statement", data.problem_statement);
      if (data.business_impact) setValue("business_impact", data.business_impact, { shouldValidate: true });
      if (data.success_criteria) setValue("success_criteria", data.success_criteria, { shouldValidate: true });
      if (data.urgency) setValue("urgency", data.urgency, { shouldValidate: true });
      if (data.file_context) setFileContext(data.file_context);
      toast({ title: "Fields extracted from file", description: "Review and adjust as needed." });
    },
    onError: (err) => {
      toast({ title: "Extraction failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    },
  });

  const effortMutation = useMutation({
    mutationFn: () => fetchEffortEstimate({
      title: watch("title") ?? "",
      business_impact: watch("business_impact") ?? undefined,
      success_criteria: watch("success_criteria") ?? undefined,
      urgency: watch("urgency") ?? undefined,
      file_context: fileContext ?? undefined,
    }),
    onSuccess: (data) => {
      const currentEffort = watch("effort_estimate");
      if (!currentEffort || isNaN(currentEffort as number)) {
        setValue("effort_estimate", data.hours, { shouldValidate: true });
        setEffortSuggestion(null);
      } else {
        setEffortSuggestion(data.hours);
      }
    },
    onError: (err) => {
      toast({ title: "Effort estimate failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: PortalFormValues) => {
      if (!dept?.id) throw new Error("Department not found");
      const payload = {
        title: data.title, department_id: dept.id,
        problem_statement: data.problem_statement ?? null, urgency: data.urgency,
        priority: data.priority, business_impact: data.business_impact,
        success_criteria: data.success_criteria, due_date: data.due_date || null,
        effort_estimate: data.effort_estimate ?? null, next_step: data.next_step || null,
        current_time_cost_hours_per_week: data.current_time_cost_hours_per_week ?? null,
        employees_affected: data.employees_affected ?? null, avg_hourly_cost: data.avg_hourly_cost ?? null,
      };
      const res = await fetch(`${API}/api/tickets`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? "Submission failed");
      }
      const ticket = await res.json();
      if (pendingFile) {
        const form = new FormData();
        form.append("file", pendingFile);
        await fetch(`${API}/api/tickets/${ticket.id}/attachments`, { method: "POST", credentials: "include", body: form });
      }
      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSubmitted(true);
    },
  });

  const onSubmit = (data: PortalFormValues) => submitMutation.mutate(data);

  // ── Success state ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="p-8 max-w-2xl mx-auto animate-enter">
        <div className="flex flex-col items-center text-center py-16 space-y-4">
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center"
            style={{ background: "#EBF7EE", border: "1px solid #A9DFB7" }}
          >
            <CheckCircle className="h-9 w-9" style={{ color: "#27AE60" }} />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: "#37352F" }}>
            Request submitted!
          </h1>
          <p className="text-sm max-w-md" style={{ color: "#9B9A97" }}>
            Your request has been added to the team board. The AI team will review and prioritise it shortly.
          </p>
          <div className="flex gap-3 pt-2">
            <Link
              href="/board"
              className="rounded-lg px-4 py-2 text-sm font-semibold transition-all"
              style={{ background: "#2383E2", color: "#FFFFFF" }}
            >
              View on board →
            </Link>
            <Link
              href="/portal"
              className="rounded-lg px-4 py-2 text-sm font-medium border transition-all"
              style={{ borderColor: "#E9E9E6", color: "#37352F", background: "transparent" }}
            >
              Submit another
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  const inputClass = "w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all duration-150 disabled:opacity-50";
  const textareaClass = "w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all duration-150 resize-none";

  function inputStyle(hasError?: boolean) {
    return {
      ...INPUT_STYLE,
      borderColor: hasError ? "#E03E3E" : "#E9E9E6",
    };
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Back nav */}
      <div className="mb-6 animate-enter">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: "#9B9A97" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portal
        </Link>
      </div>

      {/* Page title */}
      <div className="mb-8 animate-enter">
        <h1
          className="font-display text-3xl font-bold tracking-tight"
          style={{ color: "#37352F" }}
        >
          New Request
        </h1>
        <p className="text-sm mt-1" style={{ color: "#9B9A97" }}>
          {deptName}
        </p>
        <div className="mt-4 h-px w-10" style={{ background: "#2383E2" }} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 animate-enter-1">

        {/* ── Request Details ── */}
        <Section title="Request Details">
          <div className="space-y-4">
            <Field label="Title" htmlFor="title" error={errors.title?.message} required>
              <input
                id="title"
                placeholder="Short, descriptive title for this request"
                {...register("title")}
                className={inputClass}
                style={inputStyle(!!errors.title)}
                onFocus={(e) => (e.target.style.borderColor = "#2383E2")}
                onBlur={(e) => (e.target.style.borderColor = errors.title ? "#E03E3E" : "#E9E9E6")}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Urgency (1–5)" htmlFor="urgency" error={errors.urgency?.message} required>
                <input
                  id="urgency" type="number" min={1} max={5} placeholder="3"
                  {...register("urgency", { valueAsNumber: true })}
                  className={inputClass}
                  style={inputStyle(!!errors.urgency)}
                  onFocus={(e) => (e.target.style.borderColor = "#2383E2")}
                  onBlur={(e) => (e.target.style.borderColor = "#E9E9E6")}
                />
              </Field>
              <Field label="Priority" htmlFor="priority" error={errors.priority?.message} required>
                <select
                  id="priority"
                  {...register("priority")}
                  className={inputClass}
                  style={{ ...inputStyle(), cursor: "pointer" }}
                  onFocus={(e) => (e.target.style.borderColor = "#2383E2")}
                  onBlur={(e) => (e.target.style.borderColor = "#E9E9E6")}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Due Date" htmlFor="due_date">
                <input
                  id="due_date" type="date" {...register("due_date")}
                  className={inputClass}
                  style={inputStyle()}
                  onFocus={(e) => (e.target.style.borderColor = "#2383E2")}
                  onBlur={(e) => (e.target.style.borderColor = "#E9E9E6")}
                />
              </Field>
              <Field label="Effort Estimate (hours)" htmlFor="effort_estimate" error={errors.effort_estimate?.message}>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      id="effort_estimate" type="number" min={0} step={0.5} placeholder="e.g. 8"
                      {...register("effort_estimate", { valueAsNumber: true })}
                      className={cn(inputClass, "flex-1")}
                      style={inputStyle()}
                      onFocus={(e) => (e.target.style.borderColor = "#2383E2")}
                      onBlur={(e) => (e.target.style.borderColor = "#E9E9E6")}
                    />
                    {aiEnabled && (
                      <button
                        type="button"
                        onClick={() => effortMutation.mutate()}
                        disabled={effortMutation.isPending}
                        className="flex-shrink-0 flex items-center gap-1 text-xs rounded-lg px-2.5 py-2 border transition-all disabled:opacity-40"
                        style={{ borderColor: "#2383E2", color: "#2383E2", background: "#EEF4FD" }}
                      >
                        {effortMutation.isPending
                          ? <><Loader2 className="h-3 w-3 animate-spin" /> …</>
                          : <><Sparkles className="h-3 w-3" /> Estimate</>
                        }
                      </button>
                    )}
                  </div>
                  {effortSuggestion !== null && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: "#9B9A97" }}>
                      <span>AI suggests: <strong style={{ color: "#2383E2" }}>{effortSuggestion}h</strong></span>
                      <button
                        type="button"
                        onClick={() => { setValue("effort_estimate", effortSuggestion, { shouldValidate: true }); setEffortSuggestion(null); }}
                        style={{ color: "#2383E2" }}
                        className="font-medium hover:opacity-80"
                      >
                        Use this
                      </button>
                      <button type="button" onClick={() => setEffortSuggestion(null)} style={{ color: "#9B9A97" }} className="hover:opacity-80">
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </Field>
            </div>
          </div>
        </Section>

        {/* ── Problem Description ── */}
        <Section title="Problem Description">
          <div className="space-y-4">
            <div className="space-y-1">
              <label style={LABEL_STYLE}>Problem Statement</label>
              <Controller
                name="problem_statement"
                control={control}
                render={({ field }) => (
                  <div
                    className="rounded-lg border overflow-hidden"
                    style={{ borderColor: "#E9E9E6", background: "#FFFFFF" }}
                  >
                    <TiptapEditor initialContent={field.value ?? null} onSave={(json) => field.onChange(json)} />
                  </div>
                )}
              />
            </div>

            <Field label="Business Impact" htmlFor="business_impact" error={errors.business_impact?.message} required>
              <textarea
                id="business_impact" rows={3}
                placeholder="What is the business impact of this problem?"
                {...register("business_impact")}
                className={textareaClass}
                style={inputStyle(!!errors.business_impact)}
                onFocus={(e) => (e.target.style.borderColor = "#2383E2")}
                onBlur={(e) => (e.target.style.borderColor = errors.business_impact ? "#E03E3E" : "#E9E9E6")}
              />
            </Field>

            <Field label="Success Criteria" htmlFor="success_criteria" error={errors.success_criteria?.message} required>
              <textarea
                id="success_criteria" rows={3}
                placeholder="How do we know this request is complete?"
                {...register("success_criteria")}
                className={textareaClass}
                style={inputStyle(!!errors.success_criteria)}
                onFocus={(e) => (e.target.style.borderColor = "#2383E2")}
                onBlur={(e) => (e.target.style.borderColor = errors.success_criteria ? "#E03E3E" : "#E9E9E6")}
              />
            </Field>

            <Field label="Next Step" htmlFor="next_step">
              <textarea
                id="next_step" rows={2}
                placeholder="What is the immediate next action?"
                {...register("next_step")}
                className={textareaClass}
                style={inputStyle()}
                onFocus={(e) => (e.target.style.borderColor = "#2383E2")}
                onBlur={(e) => (e.target.style.borderColor = "#E9E9E6")}
              />
            </Field>
          </div>
        </Section>

        {/* ── ROI Information ── */}
        <Section
          title="ROI Information"
          note="Row 1 (Hours/week, Employees affected, Avg hourly cost) must all be provided."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Hours saved / week" htmlFor="current_time_cost_hours_per_week" error={errors.current_time_cost_hours_per_week?.message} required>
                <input
                  id="current_time_cost_hours_per_week" type="number" min={0} step={0.5} placeholder="e.g. 2"
                  {...register("current_time_cost_hours_per_week", { valueAsNumber: true })}
                  className={inputClass}
                  style={inputStyle(!!errors.current_time_cost_hours_per_week)}
                  onFocus={(e) => (e.target.style.borderColor = "#2383E2")}
                  onBlur={(e) => (e.target.style.borderColor = "#E9E9E6")}
                />
              </Field>
              <Field label="Employees affected" htmlFor="employees_affected" error={errors.employees_affected?.message} required>
                <input
                  id="employees_affected" type="number" min={1} step={1} placeholder="e.g. 10"
                  {...register("employees_affected", { valueAsNumber: true })}
                  className={inputClass}
                  style={inputStyle(!!errors.employees_affected)}
                  onFocus={(e) => (e.target.style.borderColor = "#2383E2")}
                  onBlur={(e) => (e.target.style.borderColor = "#E9E9E6")}
                />
              </Field>
              <Field label="Avg hourly cost ($)" htmlFor="avg_hourly_cost" error={errors.avg_hourly_cost?.message} required>
                <input
                  id="avg_hourly_cost" type="number" min={0} step={0.01} placeholder="e.g. 50"
                  {...register("avg_hourly_cost", { valueAsNumber: true })}
                  className={inputClass}
                  style={inputStyle(!!errors.avg_hourly_cost)}
                  onFocus={(e) => (e.target.style.borderColor = "#2383E2")}
                  onBlur={(e) => (e.target.style.borderColor = "#E9E9E6")}
                />
              </Field>
            </div>

            {/* ROI preview */}
            <div
              className="rounded-lg px-4 py-3 border transition-all duration-300"
              style={{
                background: liveAnnualSavings > 0 ? "#EBF7EE" : "#F7F7F5",
                borderColor: liveAnnualSavings > 0 ? "#A9DFB7" : "#E9E9E6",
              }}
            >
              <p className="text-sm" style={{ color: "#37352F" }}>
                Estimated annual savings:{" "}
                <strong
                  className="font-mono text-base"
                  style={{ color: liveAnnualSavings > 0 ? "#27AE60" : "#9B9A97" }}
                >
                  ${liveAnnualSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </strong>
                {liveWeeklyCost > 0 && (
                  <span className="font-mono text-xs ml-2" style={{ color: "#9B9A97" }}>
                    (weekly ${liveWeeklyCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}, yearly ${liveYearlyCost.toLocaleString("en-US", { maximumFractionDigits: 0 })})
                  </span>
                )}
                {liveWeeklyCost === 0 && (
                  <span className="text-xs ml-2 font-mono" style={{ color: "#9B9A97" }}>
                    Fill in Row 1 to see estimate
                  </span>
                )}
              </p>
            </div>
          </div>
        </Section>

        {/* ── Attachment ── */}
        <Section title="Attachment" note="Upload a PDF, DOCX, TXT, or MD file. If AI is enabled, fields will be auto-extracted.">
          {pendingFile ? (
            <div
              className="flex items-center gap-3 p-3 rounded-lg border"
              style={{ background: "#F7F7F5", borderColor: "#E9E9E6" }}
            >
              <Paperclip className="h-4 w-4 flex-shrink-0" style={{ color: "#2383E2" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: "#37352F" }}>{pendingFile.name}</p>
                <p className="text-xs font-mono" style={{ color: "#9B9A97" }}>
                  {(pendingFile.size / 1024).toFixed(1)} KB
                  {fileContext && " · Fields extracted"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setPendingFile(null); setFileContext(null); }}
                className="flex-shrink-0 p-1 rounded transition-colors"
                style={{ color: "#9B9A97" }}
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200"
              style={{ borderColor: "#E9E9E6" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#2383E2";
                (e.currentTarget as HTMLElement).style.background = "#EEF4FD";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#E9E9E6";
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <Paperclip className="h-6 w-6" style={{ color: "#9B9A97" }} />
              <p className="text-sm" style={{ color: "#9B9A97" }}>Click to upload a file</p>
              <p className="text-xs font-mono" style={{ color: "#B8B7B3" }}>PDF · DOCX · TXT · MD · max 10 MB</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              e.target.value = "";
              setPendingFile(file);
              setFileContext(null);
              if (aiEnabled) extractMutation.mutate(file);
            }}
          />
          {extractMutation.isPending && (
            <p className="flex items-center gap-1.5 text-xs mt-2" style={{ color: "#2383E2" }}>
              <Loader2 className="h-3 w-3 animate-spin" />
              Extracting fields with AI…
            </p>
          )}
        </Section>

        {/* ── Submit ── */}
        <div className="flex items-center justify-between pt-2 animate-enter-2">
          <button
            type="button"
            onClick={() => router.push("/portal")}
            className="rounded-lg px-4 py-2.5 text-sm transition-all"
            style={{ color: "#9B9A97" }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting || submitMutation.isPending}
            className="min-w-[160px] rounded-lg py-2.5 px-6 text-sm font-semibold transition-all duration-150 disabled:opacity-50"
            style={{ background: "#2383E2", color: "#FFFFFF" }}
          >
            {submitMutation.isPending ? "Submitting…" : "Submit Request"}
          </button>
        </div>

        {submitMutation.isError && (
          <p className="text-sm text-right" style={{ color: "#E03E3E" }}>
            {submitMutation.error instanceof Error ? submitMutation.error.message : "Submission failed."}
          </p>
        )}
      </form>
    </div>
  );
}
