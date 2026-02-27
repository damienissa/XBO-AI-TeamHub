"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TiptapEditor } from "@/app/(app)/board/_components/TiptapEditor";

const API = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Template {
  id: string;
  title: string;
  problem_statement: object | null;
  default_urgency: number | null;
  default_effort_estimate: number | null;
  default_next_step: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const templateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  problem_statement: z.unknown().optional(),
  default_urgency: z.number().int().min(1).max(5).optional(),
  default_effort_estimate: z.number().min(0).optional(),
  default_next_step: z.string().optional(),
});

type TemplateFormValues = {
  title: string;
  problem_statement?: unknown;
  default_urgency?: number;
  default_effort_estimate?: number;
  default_next_step?: string;
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch(`${API}/api/templates`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch templates");
  return res.json();
}

async function createTemplate(data: TemplateFormValues): Promise<Template> {
  const res = await fetch(`${API}/api/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create template");
  return res.json();
}

async function updateTemplate(id: string, data: Partial<TemplateFormValues>): Promise<Template> {
  const res = await fetch(`${API}/api/templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update template");
  return res.json();
}

async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${API}/api/templates/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete template");
}

// ─── Template form (create + edit) ───────────────────────────────────────────

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTarget?: Template | null;
  onSuccess: () => void;
}

function TemplateFormDialog({ open, onOpenChange, editTarget, onSuccess }: TemplateFormDialogProps) {
  const isEditing = Boolean(editTarget);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: editTarget
      ? {
          title: editTarget.title,
          problem_statement: editTarget.problem_statement ?? undefined,
          default_urgency: editTarget.default_urgency ?? undefined,
          default_effort_estimate: editTarget.default_effort_estimate ?? undefined,
          default_next_step: editTarget.default_next_step ?? undefined,
        }
      : {
          title: "",
          problem_statement: undefined,
          default_urgency: undefined,
          default_effort_estimate: undefined,
          default_next_step: undefined,
        },
  });

  async function onSubmit(values: TemplateFormValues) {
    // Strip undefined optional fields
    const payload: Partial<TemplateFormValues> = { title: values.title };
    if (values.problem_statement !== undefined) payload.problem_statement = values.problem_statement;
    if (values.default_urgency !== undefined) payload.default_urgency = values.default_urgency;
    if (values.default_effort_estimate !== undefined) payload.default_effort_estimate = values.default_effort_estimate;
    if (values.default_next_step !== undefined && values.default_next_step !== "") payload.default_next_step = values.default_next_step;

    if (isEditing && editTarget) {
      await updateTemplate(editTarget.id, payload);
    } else {
      await createTemplate(payload as TemplateFormValues);
    }
    reset();
    onSuccess();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Template" : "New Template"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#37352F" }}>
              Title <span style={{ color: "#E03E3E" }}>*</span>
            </label>
            <input
              {...register("title")}
              placeholder="e.g. Standard Bug Report"
              className="w-full text-sm px-3 py-2 rounded focus:outline-none"
              style={{ border: "1px solid #E9E9E6", color: "#37352F" }}
            />
            {errors.title && (
              <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Problem Statement */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#37352F" }}>
              Problem Statement <span className="text-xs font-normal" style={{ color: "#9B9A97" }}>(optional)</span>
            </label>
            <Controller
              name="problem_statement"
              control={control}
              render={({ field }) => (
                <TiptapEditor
                  initialContent={(field.value as object | null | undefined) ?? null}
                  onSave={(json) => field.onChange(json)}
                />
              )}
            />
          </div>

          {/* Default Urgency */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#37352F" }}>
              Default Urgency <span className="text-xs font-normal" style={{ color: "#9B9A97" }}>(1–5, optional)</span>
            </label>
            <input
              type="number"
              min={1}
              max={5}
              {...register("default_urgency", { valueAsNumber: true })}
              placeholder="1–5"
              className="w-28 text-sm px-3 py-2 rounded focus:outline-none"
              style={{ border: "1px solid #E9E9E6", color: "#37352F" }}
            />
            {errors.default_urgency && (
              <p className="text-xs text-red-500 mt-1">{errors.default_urgency.message}</p>
            )}
          </div>

          {/* Default Effort Estimate */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#37352F" }}>
              Default Effort Estimate <span className="text-xs font-normal" style={{ color: "#9B9A97" }}>(hours, optional)</span>
            </label>
            <input
              type="number"
              min={0}
              step="0.5"
              {...register("default_effort_estimate", { valueAsNumber: true })}
              placeholder="e.g. 4"
              className="w-28 text-sm px-3 py-2 rounded focus:outline-none"
              style={{ border: "1px solid #E9E9E6", color: "#37352F" }}
            />
            {errors.default_effort_estimate && (
              <p className="text-xs text-red-500 mt-1">{errors.default_effort_estimate.message}</p>
            )}
          </div>

          {/* Default Next Step */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#37352F" }}>
              Default Next Step <span className="text-xs font-normal" style={{ color: "#9B9A97" }}>(optional)</span>
            </label>
            <textarea
              {...register("default_next_step")}
              rows={3}
              placeholder="e.g. Reproduce the issue and document steps"
              className="w-full text-sm px-3 py-2 rounded focus:outline-none resize-none"
              style={{ border: "1px solid #E9E9E6", color: "#37352F" }}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const { data: templates, isPending, isError } = useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setDeleteTarget(null);
    },
  });

  function handleEdit(template: Template) {
    setEditTarget(template);
    setFormOpen(true);
  }

  function handleNewTemplate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function handleFormSuccess() {
    queryClient.invalidateQueries({ queryKey: ["templates"] });
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#37352F" }}>Ticket Templates</h1>
          <p className="text-sm mt-1" style={{ color: "#9B9A97" }}>Reusable request templates for common request types.</p>
        </div>
        <Button onClick={handleNewTemplate} className="flex-shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Loading state */}
      {isPending && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#9B9A97" }} />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="p-6 text-red-500 text-sm rounded border border-red-200 bg-red-50">
          Failed to load templates. Please refresh and try again.
        </div>
      )}

      {/* Empty state */}
      {templates && templates.length === 0 && (
        <div className="text-center py-16 border border-dashed rounded-xl" style={{ borderColor: "#E9E9E6" }}>
          <p className="text-sm mb-3" style={{ color: "#B8B7B3" }}>No templates yet</p>
          <Button variant="outline" size="sm" onClick={handleNewTemplate}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first template
          </Button>
        </div>
      )}

      {/* Template list */}
      {templates && templates.length > 0 && (
        <div className="rounded-xl overflow-hidden bg-white" style={{ border: "1px solid #E9E9E6" }}>
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between px-5 py-4 transition-colors"
              style={{ borderBottom: "1px solid #F0F0EE" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#F7F7F5")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "#37352F" }}>{template.title}</p>
                <div className="flex items-center gap-3 mt-1">
                  {template.default_urgency != null && (
                    <span className="text-xs" style={{ color: "#9B9A97" }}>
                      Urgency: <span className="font-medium">{template.default_urgency}</span>
                    </span>
                  )}
                  {template.default_effort_estimate != null && (
                    <span className="text-xs" style={{ color: "#9B9A97" }}>
                      Effort: <span className="font-medium">{template.default_effort_estimate}h</span>
                    </span>
                  )}
                  {template.default_next_step && (
                    <span className="text-xs truncate max-w-xs" style={{ color: "#B8B7B3" }}>
                      Next step: {template.default_next_step}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(template)}
                  className="h-8 w-8 p-0"
                  style={{ color: "#9B9A97" }}
                  aria-label={`Edit ${template.title}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(template)}
                  className="h-8 w-8 p-0 hover:text-red-600"
                  style={{ color: "#9B9A97" }}
                  aria-label={`Delete ${template.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog — key forces remount so useForm picks up fresh defaultValues */}
      <TemplateFormDialog
        key={editTarget?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        editTarget={editTarget}
        onSuccess={handleFormSuccess}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template &quot;{deleteTarget?.title}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The template will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
