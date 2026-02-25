"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertCircle,
  Clock,
  LayoutGrid,
  TrendingUp,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ----- Types ----------------------------------------------------------------

interface ColumnTimeOut {
  column: string;
  avg_hours: number;
}

interface WorkloadItemOut {
  user_id: string;
  user_name: string;
  total_hours: number;
}

interface DeptBreakdownItemOut {
  department_id: string;
  department_name: string;
  ticket_count: number;
  avg_cycle_hours: number | null;
}

interface ThroughputPointOut {
  week: string;
  count: number;
}

interface StatusBreakdownItemOut {
  status: string;
  count: number;
}

interface OwnerTicketCountOut {
  user_id: string;
  user_name: string;
  ticket_count: number;
}

interface UpcomingReleaseOut {
  ticket_id: string;
  title: string;
  due_date: string;
  status: string;
  owner_name: string | null;
}

interface DashboardOut {
  open_ticket_count: number;
  overdue_count: number;
  throughput_last_week: number;
  avg_cycle_time_hours: number | null;
  column_times: ColumnTimeOut[];
  workload: WorkloadItemOut[];
  dept_breakdown: DeptBreakdownItemOut[];
  throughput_trend: ThroughputPointOut[];
  status_breakdown: StatusBreakdownItemOut[];
  tickets_by_owner: OwnerTicketCountOut[];
  upcoming_releases: UpcomingReleaseOut[];
}

// ----- Helpers ---------------------------------------------------------------

function formatHours(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  return `${h.toFixed(1)}h`;
}

const STATUS_COLORS: Record<string, string> = {
  Backlog: "bg-slate-100 text-slate-600",
  Discovery: "bg-purple-100 text-purple-700",
  "In Progress": "bg-blue-100 text-blue-700",
  "Review/QA": "bg-yellow-100 text-yellow-700",
  Done: "bg-green-100 text-green-700",
};

const STATUS_ORDER = ["Backlog", "Discovery", "In Progress", "Review/QA", "Done"];

// ----- Loading skeleton ------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl border bg-slate-100 animate-pulse"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 rounded-xl border bg-slate-100 animate-pulse" />
        <div className="h-64 rounded-xl border bg-slate-100 animate-pulse" />
      </div>
      <div className="h-48 rounded-xl border bg-slate-100 animate-pulse" />
      <div className="h-56 rounded-xl border bg-slate-100 animate-pulse" />
    </div>
  );
}

// ----- Main page component ---------------------------------------------------

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery<DashboardOut>({
    queryKey: ["dashboard"],
    queryFn: () =>
      fetch(`${API_BASE}/api/dashboard`, { credentials: "include" }).then((r) =>
        r.json()
      ),
    staleTime: 5 * 60 * 1000, // 5 minutes — no auto-refresh (RESEARCH.md Open Question 3)
  });

  if (isLoading) return <LoadingSkeleton />;

  if (isError || !data) {
    return (
      <div className="p-6 text-red-600">
        Failed to load dashboard. Please try refreshing.
      </div>
    );
  }

  // Compute bottleneck column (highest avg_hours)
  const bottleneck =
    data.column_times.length > 0
      ? data.column_times.reduce(
          (max, ct) => (ct.avg_hours > max.avg_hours ? ct : max),
          data.column_times[0]
        )
      : null;

  // Prepare workload chart data
  const workloadChartData = data.workload.map((w) => ({
    name: w.user_name.split(" ")[0],
    hours: parseFloat(w.total_hours.toFixed(1)),
  }));

  // Prepare throughput chart data — format week labels as "MMM d"
  const throughputChartData = data.throughput_trend.map((p) => ({
    week: (() => {
      try {
        return format(new Date(p.week), "MMM d");
      } catch {
        return p.week;
      }
    })(),
    count: p.count,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Row 1 — KPI Cards                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Tickets */}
        <div className="flex items-start gap-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">
              {data.open_ticket_count}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Open Tickets</p>
          </div>
        </div>

        {/* Throughput (last 7 days) */}
        <div className="flex items-start gap-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">
              {data.throughput_last_week}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Delivered (last 7d)</p>
          </div>
        </div>

        {/* Avg Cycle Time */}
        <div className="flex items-start gap-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">
              {data.avg_cycle_time_hours != null
                ? `${data.avg_cycle_time_hours.toFixed(1)}h`
                : "—"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Avg Cycle Time</p>
          </div>
        </div>

        {/* Overdue */}
        <div className="flex items-start gap-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">
              {data.overdue_count}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Overdue</p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 2 — Upcoming Due Dates + Department Breakdown Table             */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming Due Dates */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Upcoming Due Dates
          </h2>
          {data.upcoming_releases.length === 0 ? (
            <p className="text-sm text-slate-400 py-12 text-center">
              No tickets with due dates set.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 text-xs font-semibold text-slate-500">
                      Ticket
                    </th>
                    <th className="pb-2 text-xs font-semibold text-slate-500">
                      Status
                    </th>
                    <th className="pb-2 text-xs font-semibold text-slate-500">
                      Owner
                    </th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 text-right">
                      Due Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcoming_releases.map((r) => {
                    const isOverdue = r.due_date < new Date().toISOString().slice(0, 10);
                    return (
                      <tr key={r.ticket_id} className="border-b last:border-0">
                        <td className="py-2 text-slate-700 max-w-xs truncate pr-4">
                          {r.title}
                        </td>
                        <td className="py-2">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                              STATUS_COLORS[r.status] ??
                              "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2 text-slate-500">
                          {r.owner_name ?? "—"}
                        </td>
                        <td
                          className={`py-2 text-right font-medium ${
                            isOverdue ? "text-red-600" : "text-slate-700"
                          }`}
                        >
                          {r.due_date}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Department Breakdown Table */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Department Breakdown
          </h2>
          {data.dept_breakdown.length === 0 ? (
            <p className="text-sm text-slate-400 py-12 text-center">
              No department data yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 text-xs font-semibold text-slate-500">
                      Department
                    </th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 text-right">
                      Tickets
                    </th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 text-right">
                      Avg Cycle
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.dept_breakdown.map((d) => (
                    <tr
                      key={d.department_id}
                      className="border-b last:border-0"
                    >
                      <td className="py-2 text-slate-700">
                        {d.department_name}
                      </td>
                      <td className="py-2 text-right text-slate-700">
                        {d.ticket_count}
                      </td>
                      <td className="py-2 text-right text-slate-500">
                        {formatHours(d.avg_cycle_hours)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 3 — Column Time Breakdown with bottleneck highlight             */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Time Per Column
        </h2>
        {data.column_times.length === 0 ? (
          <p className="text-sm text-slate-400">No column data yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {data.column_times.map((ct) => {
              const isBottleneck =
                bottleneck !== null && ct.column === bottleneck.column;
              return (
                <div
                  key={ct.column}
                  className={`rounded-lg border p-3 bg-white ${
                    isBottleneck
                      ? "border-orange-400 border-2"
                      : "border-slate-200"
                  }`}
                >
                  <p className="text-xs font-medium text-slate-500 truncate">
                    {ct.column}
                  </p>
                  <p className="text-lg font-bold text-slate-800 mt-1">
                    {ct.avg_hours.toFixed(1)}h
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 4 — Throughput Trend AreaChart                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Delivered (Last 8 Weeks)
        </h2>
        {throughputChartData.length === 0 ? (
          <p className="text-sm text-slate-400">
            No done tickets in the past 8 weeks.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={throughputChartData}
              margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                allowDecimals={false}
              />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                fill="#eff6ff"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 5 — Tickets by Status                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Tickets by Status
        </h2>
        {data.status_breakdown.length === 0 ? (
          <p className="text-sm text-slate-400">No tickets yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {STATUS_ORDER.map((status) => {
              const item = data.status_breakdown.find(
                (s) => s.status === status
              );
              const count = item?.count ?? 0;
              const colorClass =
                STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600";
              return (
                <div
                  key={status}
                  className={`flex items-center gap-2 rounded-lg px-4 py-3 ${colorClass}`}
                >
                  <span className="text-2xl font-bold">{count}</span>
                  <span className="text-xs font-medium">{status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 6 — Tickets by Owner                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Tickets by Owner
        </h2>
        {data.tickets_by_owner.length === 0 ? (
          <p className="text-sm text-slate-400">No assigned tickets yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 text-xs font-semibold text-slate-500">
                    Owner
                  </th>
                  <th className="pb-2 text-xs font-semibold text-slate-500 text-right">
                    Tickets
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.tickets_by_owner.map((o) => (
                  <tr key={o.user_id} className="border-b last:border-0">
                    <td className="py-2 text-slate-700">{o.user_name}</td>
                    <td className="py-2 text-right font-semibold text-slate-800">
                      {o.ticket_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 7 — Active Effort Hours BarChart                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Active Effort Hours
        </h2>
        {workloadChartData.length === 0 ? (
          <p className="text-sm text-slate-400">
            No active tickets with effort estimates set.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={workloadChartData}
              margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                label={{
                  value: "hours",
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 10,
                }}
              />
              <Tooltip />
              <Bar
                dataKey="hours"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
