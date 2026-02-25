"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useQueryState, parseAsString } from "nuqs";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { Building2, Clock, TrendingUp, Ticket as TicketIcon } from "lucide-react";
import { TicketDetailModal } from "@/app/(app)/board/_components/TicketDetailModal";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DepartmentOut {
  id: string;
  slug: string;
  name: string;
}

interface TicketOut {
  id: string;
  title: string;
  status_column: string;
  priority: string | null;
  owner: { id: string; full_name: string } | null;
  created_at: string;
  due_date: string | null;
  roi: number | null;
}

interface DeptDashboardOut {
  department: DepartmentOut;
  open_ticket_count: number;
  avg_age_open_hours: number | null;
  avg_cycle_time_hours: number | null;
  avg_roi: number | null;
  tickets: TicketOut[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const remaining = Math.round(hours % 24);
  return remaining > 0 ? `${days}d ${remaining}h` : `${days}d`;
}

const STATUS_COLORS: Record<string, string> = {
  Backlog: "bg-slate-100 text-slate-600",
  Discovery: "bg-blue-100 text-blue-700",
  "In Progress": "bg-emerald-100 text-emerald-700",
  "Review/QA": "bg-amber-100 text-amber-700",
  Done: "bg-green-100 text-green-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-500",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        {icon}
        {label}
      </div>
      <p className={`text-3xl font-bold text-slate-800 ${valueClass ?? ""}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DeptDashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setTicketId] = useQueryState("ticket", parseAsString);

  const { data, isLoading, isError } = useQuery<DeptDashboardOut>({
    queryKey: ["dept-dashboard", slug],
    queryFn: async () => {
      const r = await fetch(`${API}/api/dashboard/dept/${slug}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Department not found");
      return r.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="p-8 text-slate-400 text-sm">Loading…</div>;
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-red-500 text-sm">
        Department not found or failed to load.
      </div>
    );
  }

  const { department, open_ticket_count, avg_age_open_hours, avg_cycle_time_hours, avg_roi, tickets } = data;

  const roiValue = avg_roi !== null ? `${avg_roi.toFixed(1)}x` : "—";
  const roiClass =
    avg_roi === null ? "" : avg_roi >= 1 ? "text-emerald-600" : "text-amber-600";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-slate-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{department.name}</h1>
          <p className="text-sm text-slate-400">Department dashboard</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<TicketIcon className="h-4 w-4" />}
          label="Open tickets"
          value={String(open_ticket_count)}
          sub="not Done"
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="Avg age (open)"
          value={formatHours(avg_age_open_hours)}
          sub="since creation"
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="Avg cycle time"
          value={formatHours(avg_cycle_time_hours)}
          sub="creation → Done"
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Avg ROI"
          value={roiValue}
          sub="across tickets"
          valueClass={roiClass}
        />
      </div>

      {/* Ticket table */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-3">
          Open Tickets{" "}
          <span className="text-slate-400 font-normal text-sm">({tickets.length})</span>
        </h2>

        {tickets.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center border border-dashed border-slate-200 rounded-lg">
            No open tickets for this department.
          </p>
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Title</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Priority</th>
                  <th className="text-left px-4 py-3 font-medium">Owner</th>
                  <th className="text-left px-4 py-3 font-medium">Age</th>
                  <th className="text-left px-4 py-3 font-medium">Due</th>
                  <th className="text-right px-4 py-3 font-medium">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => setTicketId(ticket.id)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[260px] truncate">
                      {ticket.title}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_COLORS[ticket.status_column] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {ticket.status_column}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {ticket.priority ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                            PRIORITY_COLORS[ticket.priority] ?? "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {ticket.priority}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {ticket.owner?.full_name ?? <span className="text-slate-300">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDistanceToNow(parseISO(ticket.created_at), { addSuffix: false })}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {ticket.due_date ? format(parseISO(ticket.due_date), "MMM d") : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {ticket.roi !== null ? (
                        <span className={ticket.roi >= 1 ? "text-emerald-600 font-medium" : "text-amber-600"}>
                          {ticket.roi.toFixed(1)}x
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket detail modal — driven by ?ticket= URL param */}
      <TicketDetailModal />
    </div>
  );
}
