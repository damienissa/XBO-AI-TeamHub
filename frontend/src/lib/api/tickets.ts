const API = process.env.NEXT_PUBLIC_API_URL;

export type StatusColumn = "Backlog" | "Discovery" | "In Progress" | "Review/QA" | "Done";
export type Priority = "low" | "medium" | "high" | "critical";

export interface Ticket {
  id: string;
  title: string;
  problem_statement: object | null;
  urgency: number | null;
  business_impact: string | null;
  success_criteria: string | null;
  due_date: string | null;
  effort_estimate: number | null;
  next_step: string | null;
  priority: Priority | null;
  status_column: StatusColumn;
  department_id: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  owner: { id: string; full_name: string; email: string } | null;
  department: { id: string; slug: string; name: string };
  time_in_column: string | null;
  // Subtask counts from board endpoint (COLLAB-07)
  subtasks_total: number;
  subtasks_done: number;

  // Phase 4 ROI input fields (ROI-01)
  current_time_cost_hours_per_week?: number | null;
  employees_affected?: number | null;
  avg_hourly_cost?: number | null;
  current_error_rate?: number | null;
  revenue_blocked?: number | null;

  // Phase 4 computed ROI output fields (ROI-02)
  weekly_cost?: number | null;
  yearly_cost?: number | null;
  annual_savings?: number | null;
  dev_cost?: number | null;
  roi?: number | null;

  // Phase 5 fields (ADV-04, ADV-09)
  sprint_id?: string | null;
  blocked_by_count?: number;

  // Phase 5 custom fields (ADV-01, ADV-02, ADV-03)
  custom_field_values?: Record<string, unknown> | null;

  // Phase 5 wiki link (WIKI-05)
  wiki_page_id?: string | null;
}

export interface BoardData {
  tickets: Ticket[];
}

export async function fetchBoard(filters: Record<string, string | null> = {}): Promise<Ticket[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  const res = await fetch(`${API}/api/board?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch board");
  return res.json();
}

export async function createTicket(data: { title: string; department_id: string }): Promise<Ticket> {
  const res = await fetch(`${API}/api/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create ticket");
  return res.json();
}

export interface MoveBlockedError {
  code: "BLOCKED";
  blocker_ids: string[];
  message: string;
}

export class TicketBlockedError extends Error {
  code = "BLOCKED" as const;
  blocker_ids: string[];
  constructor(detail: MoveBlockedError) {
    super(detail.message);
    this.blocker_ids = detail.blocker_ids;
  }
}

export async function moveTicket(ticketId: string, targetColumn: StatusColumn, ownerId: string | null): Promise<Ticket> {
  const res = await fetch(`${API}/api/tickets/${ticketId}/move`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ target_column: targetColumn, owner_id: ownerId }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const detail = (error as { detail?: MoveBlockedError | string }).detail;
    if (res.status === 409 && detail && typeof detail === "object" && detail.code === "BLOCKED") {
      throw new TicketBlockedError(detail);
    }
    throw new Error(typeof detail === "string" ? detail : "Move failed");
  }
  return res.json();
}

export async function updateTicket(ticketId: string, data: Partial<Ticket>): Promise<Ticket> {
  const res = await fetch(`${API}/api/tickets/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update ticket");
  return res.json();
}

export async function fetchUsers(): Promise<{ id: string; full_name: string; email: string }[]> {
  const res = await fetch(`${API}/api/auth/users`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function fetchTicket(ticketId: string): Promise<Ticket> {
  const res = await fetch(`${API}/api/tickets/${ticketId}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch ticket");
  return res.json();
}

export interface TicketEvent {
  id: string;
  ticket_id: string;
  event_type: "created" | "moved" | "assigned" | "edited";
  payload: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

export interface ColumnHistoryEntry {
  id: string;
  ticket_id: string;
  column: string;
  entered_at: string;
  exited_at: string | null;
  time_spent: string | null;
}

export async function fetchTicketEvents(ticketId: string): Promise<TicketEvent[]> {
  const res = await fetch(`${API}/api/tickets/${ticketId}/events`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}

export async function fetchTicketHistory(ticketId: string): Promise<ColumnHistoryEntry[]> {
  const res = await fetch(`${API}/api/tickets/${ticketId}/history`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "member";
  is_active: boolean;
}

export async function fetchMe(): Promise<CurrentUser> {
  const res = await fetch(`${API}/api/auth/me`, { credentials: "include" });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}
