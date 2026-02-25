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

export async function moveTicket(ticketId: string, targetColumn: StatusColumn, ownerId: string | null): Promise<Ticket> {
  const res = await fetch(`${API}/api/tickets/${ticketId}/move`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ target_column: targetColumn, owner_id: ownerId }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail ?? "Move failed");
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
