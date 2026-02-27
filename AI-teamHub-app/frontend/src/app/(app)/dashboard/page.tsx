"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, Clock, LayoutGrid, TrendingUp } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
import { AreaChart, Area, BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface ColumnTimeOut { column: string; avg_hours: number; }
interface WorkloadItemOut { user_id: string; user_name: string; total_hours: number; }
interface DeptBreakdownItemOut { department_id: string; department_name: string; ticket_count: number; avg_cycle_hours: number | null; }
interface ThroughputPointOut { week: string; count: number; }
interface StatusBreakdownItemOut { status: string; count: number; }
interface OwnerTicketCountOut { user_id: string; user_name: string; ticket_count: number; }
interface UpcomingReleaseOut { ticket_id: string; title: string; due_date: string; status: string; owner_name: string | null; }
interface DashboardOut {
  open_ticket_count: number; overdue_count: number; throughput_last_week: number;
  avg_cycle_time_hours: number | null; column_times: ColumnTimeOut[]; workload: WorkloadItemOut[];
  dept_breakdown: DeptBreakdownItemOut[]; throughput_trend: ThroughputPointOut[];
  status_breakdown: StatusBreakdownItemOut[]; tickets_by_owner: OwnerTicketCountOut[];
  upcoming_releases: UpcomingReleaseOut[];
}

function formatHours(h: number | null | undefined): string {
  return h == null ? "—" : `${h.toFixed(1)}h`;
}

const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  Backlog:      { dot: "#9B9A97", bg: "#F3F3F1", text: "#73726E" },
  Discovery:    { dot: "#9B59B6", bg: "#F5F0FB", text: "#7D3C98" },
  "In Progress":{ dot: "#E67E22", bg: "#FEF9F0", text: "#A04000" },
  "Review/QA":  { dot: "#2383E2", bg: "#EEF4FD", text: "#1A5276" },
  Done:         { dot: "#27AE60", bg: "#EBF7EE", text: "#1E8449" },
};

const STATUS_ORDER = ["Backlog", "Discovery", "In Progress", "Review/QA", "Done"];

const CARD = "rounded-xl border bg-white p-5";
const CARD_STYLE = { borderColor: "#E9E9E6", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
const TH = { color: "#9B9A97", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" as const, letterSpacing: "0.05em" };

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border bg-white animate-pulse" style={{ borderColor: "#E9E9E6" }} />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery<DashboardOut>({
    queryKey: ["dashboard"],
    queryFn: () => fetch(`${API_BASE}/api/dashboard`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 0,
    refetchInterval: 30_000,
  });

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !data) return <div className="p-6 text-red-500 text-sm">Failed to load dashboard.</div>;

  const workloadChartData = data.workload.map((w) => ({ name: w.user_name.split(" ")[0], hours: parseFloat(w.total_hours.toFixed(1)) }));
  const throughputChartData = data.throughput_trend.map((p) => ({
    week: (() => { try { return format(new Date(p.week), "MMM d"); } catch { return p.week; } })(),
    count: p.count,
  }));

  const kpis = [
    { icon: LayoutGrid, value: data.open_ticket_count, label: "Open Tickets", color: "#2383E2", bg: "#EEF4FD" },
    { icon: TrendingUp, value: data.throughput_last_week, label: "Delivered (7d)", color: "#27AE60", bg: "#EBF7EE" },
    { icon: Clock, value: data.avg_cycle_time_hours != null ? `${data.avg_cycle_time_hours.toFixed(1)}h` : "—", label: "Avg Cycle Time", color: "#9B59B6", bg: "#F5F0FB" },
    { icon: AlertCircle, value: data.overdue_count, label: "Overdue", color: "#E74C3C", bg: "#FDEDEC" },
  ];

  const axisStyle = { fontSize: 11, fill: "#9B9A97", fontFamily: "'JetBrains Mono', monospace" };
  const gridStroke = "#F0F0EE";

  return (
    <div className="p-6 space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-enter">
        {kpis.map(({ icon: Icon, value, label, color, bg }) => (
          <div key={label} className={CARD} style={CARD_STYLE}>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div>
                <p className="font-mono text-2xl font-semibold leading-none" style={{ color: "#37352F" }}>{value}</p>
                <p className="text-xs mt-1.5" style={{ color: "#9B9A97" }}>{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming + Dept */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-enter-1">
        <div className={CARD} style={CARD_STYLE}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#37352F" }}>Upcoming Due Dates</h2>
          {data.upcoming_releases.length === 0
            ? <p className="text-sm text-center py-10" style={{ color: "#9B9A97" }}>No tickets with due dates.</p>
            : <table className="w-full text-xs">
                <thead><tr style={{ borderBottom: "1px solid #F0F0EE" }}>
                  {["Ticket","Status","Owner","Due"].map((h,i)=>(
                    <th key={h} style={{...TH, paddingBottom:8, textAlign: i===3?"right":"left"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {data.upcoming_releases.map((r) => {
                    const isOverdue = r.due_date < new Date().toISOString().slice(0, 10);
                    const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS.Backlog;
                    return (
                      <tr key={r.ticket_id} style={{ borderBottom: "1px solid #F7F7F5" }}>
                        <td className="py-2 pr-3 truncate max-w-[130px]" style={{ color: "#37352F" }}>{r.title}</td>
                        <td className="py-2 pr-3">
                          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium" style={{ background: sc.bg, color: sc.text }}>
                            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: sc.dot }} />
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2 pr-3" style={{ color: "#9B9A97" }}>{r.owner_name ?? "—"}</td>
                        <td className="py-2 text-right font-mono" style={{ color: isOverdue ? "#E74C3C" : "#73726E" }}>{r.due_date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          }
        </div>
        <div className={CARD} style={CARD_STYLE}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#37352F" }}>Department Breakdown</h2>
          {data.dept_breakdown.length === 0
            ? <p className="text-sm text-center py-10" style={{ color: "#9B9A97" }}>No data yet.</p>
            : <table className="w-full text-xs">
                <thead><tr style={{ borderBottom: "1px solid #F0F0EE" }}>
                  <th style={{ ...TH, paddingBottom: 8, textAlign: "left" }}>Department</th>
                  <th style={{ ...TH, paddingBottom: 8, textAlign: "right" }}>Tickets</th>
                  <th style={{ ...TH, paddingBottom: 8, textAlign: "right" }}>Avg Cycle</th>
                </tr></thead>
                <tbody>
                  {data.dept_breakdown.map((d) => (
                    <tr key={d.department_id} style={{ borderBottom: "1px solid #F7F7F5" }}>
                      <td className="py-2" style={{ color: "#37352F" }}>{d.department_name}</td>
                      <td className="py-2 text-right font-mono font-medium" style={{ color: "#2383E2" }}>{d.ticket_count}</td>
                      <td className="py-2 text-right font-mono" style={{ color: "#9B9A97" }}>{formatHours(d.avg_cycle_hours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      </div>

      {/* Throughput */}
      <div className={`${CARD} animate-enter-2`} style={CARD_STYLE}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: "#37352F" }}>Delivered — Last 8 Weeks</h2>
        {throughputChartData.length === 0
          ? <p className="text-sm" style={{ color: "#9B9A97" }}>No data.</p>
          : <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={throughputChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2383E2" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#2383E2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="week" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E9E9E6", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#2383E2" strokeWidth={2} fill="url(#blueGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
        }
      </div>

      {/* Status breakdown */}
      <div className={`${CARD} animate-enter-3`} style={CARD_STYLE}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: "#37352F" }}>Tickets by Status</h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.map((status) => {
            const count = data.status_breakdown.find((s) => s.status === status)?.count ?? 0;
            const sc = STATUS_COLORS[status] ?? STATUS_COLORS.Backlog;
            return (
              <div key={status} className="flex items-center gap-2 rounded-lg px-3 py-2.5 border" style={{ background: sc.bg, borderColor: "transparent" }}>
                <span className="h-2 w-2 rounded-full" style={{ background: sc.dot }} />
                <span className="font-mono text-lg font-semibold" style={{ color: sc.text }}>{count}</span>
                <span className="text-xs" style={{ color: sc.text, opacity: 0.8 }}>{status}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Owner + Effort */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-enter-4">
        <div className={CARD} style={CARD_STYLE}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#37352F" }}>Tickets by Owner</h2>
          {data.tickets_by_owner.length === 0
            ? <p className="text-sm" style={{ color: "#9B9A97" }}>No assigned tickets.</p>
            : <table className="w-full text-xs">
                <thead><tr style={{ borderBottom: "1px solid #F0F0EE" }}>
                  <th style={{ ...TH, paddingBottom: 8, textAlign: "left" }}>Owner</th>
                  <th style={{ ...TH, paddingBottom: 8, textAlign: "right" }}>Tickets</th>
                </tr></thead>
                <tbody>
                  {data.tickets_by_owner.map((o) => (
                    <tr key={o.user_id} style={{ borderBottom: "1px solid #F7F7F5" }}>
                      <td className="py-2" style={{ color: "#37352F" }}>{o.user_name}</td>
                      <td className="py-2 text-right font-mono font-semibold" style={{ color: "#2383E2" }}>{o.ticket_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
        <div className={CARD} style={CARD_STYLE}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#37352F" }}>Active Effort Hours</h2>
          {workloadChartData.length === 0
            ? <p className="text-sm" style={{ color: "#9B9A97" }}>No effort estimates set.</p>
            : <ResponsiveContainer width="100%" height={160}>
                <BarChart data={workloadChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E9E9E6", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="hours" fill="#2383E2" radius={[3, 3, 0, 0]} maxBarSize={40} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
          }
        </div>
      </div>
    </div>
  );
}
