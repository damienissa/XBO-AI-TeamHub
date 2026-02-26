const API = process.env.NEXT_PUBLIC_API_URL;

export interface SubtaskResult {
  subtasks: string[];
}

export interface EffortResult {
  hours: number;
}

export interface SummaryResult {
  summary: string;
}

export interface ExtractFieldsResult {
  title?: string | null;
  problem_statement?: string | null;
  business_impact?: string | null;
  success_criteria?: string | null;
  urgency?: number | null;
  file_context?: string | null;
}

export interface TicketContext {
  title: string;
  problem_statement?: string | null;
  business_impact?: string | null;
  success_criteria?: string | null;
  urgency?: number | null;
  existing_subtasks?: string[];
  custom_fields?: Record<string, unknown> | null;
  file_context?: string | null;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "AI request failed");
  }
  return res.json();
}

export async function fetchSubtasks(ctx: TicketContext): Promise<SubtaskResult> {
  const res = await fetch(`${API}/api/ai/subtasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(ctx),
  });
  return handleResponse<SubtaskResult>(res);
}

export async function fetchEffortEstimate(ctx: TicketContext): Promise<EffortResult> {
  const res = await fetch(`${API}/api/ai/effort_estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(ctx),
  });
  return handleResponse<EffortResult>(res);
}

export async function fetchSummary(ticketId: string): Promise<SummaryResult> {
  const res = await fetch(`${API}/api/ai/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ticket_id: ticketId }),
  });
  return handleResponse<SummaryResult>(res);
}

export async function extractFields(file: File): Promise<ExtractFieldsResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/api/ai/extract_fields`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  return handleResponse<ExtractFieldsResult>(res);
}
