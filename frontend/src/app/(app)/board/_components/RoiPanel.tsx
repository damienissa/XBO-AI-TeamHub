"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Ticket } from "@/lib/api/tickets";

// ---- Formatting helpers ---------------------------------------------------

const fmt$ = (v: number | null | undefined) =>
  v == null ? "—" : `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const fmtPct = (v: number | null | undefined) =>
  v == null ? "—" : `${(v * 100).toFixed(1)}%`;

// ---- Stat cell for the hero / supporting grid ----------------------------

function StatCell({
  label,
  value,
  large,
  muted,
}: {
  label: string;
  value: string;
  large?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <span
        className={
          large
            ? "text-2xl font-bold text-slate-900"
            : muted
            ? "text-sm text-slate-400"
            : "text-sm font-semibold text-slate-700"
        }
      >
        {value}
      </span>
    </div>
  );
}

// ---- ROI input field -------------------------------------------------------

interface RoiInputProps {
  label: string;
  field: string;
  value: number | null | undefined;
  min?: number;
  max?: number;
  step?: number;
  onChange: (field: string, value: number | null) => void;
  onBlur: (field: string, value: number | null) => void;
}

function RoiInput({ label, field, value, min = 0, max, step, onChange, onBlur }: RoiInputProps) {
  const [local, setLocal] = useState<string>(value != null ? String(value) : "");

  // Sync from prop when ticket refreshes
  useEffect(() => {
    setLocal(value != null ? String(value) : "");
  }, [value]);

  const parsed = local !== "" ? parseFloat(local) : null;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step ?? "any"}
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          const v = e.target.value !== "" ? parseFloat(e.target.value) : null;
          onChange(field, v);
        }}
        onBlur={() => onBlur(field, parsed)}
        className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder:text-slate-400"
        placeholder="—"
      />
    </div>
  );
}

// ---- RoiPanel (main export) -----------------------------------------------

interface RoiPanelProps {
  ticket: Ticket;
  onUpdate: (fields: Partial<Ticket>) => void;
}

export default function RoiPanel({ ticket, onUpdate }: RoiPanelProps) {
  const [draft, setDraft] = useState({
    current_time_cost_hours_per_week: ticket.current_time_cost_hours_per_week ?? null,
    employees_affected: ticket.employees_affected ?? null,
    avg_hourly_cost: ticket.avg_hourly_cost ?? null,
    current_error_rate: ticket.current_error_rate ?? null,
    revenue_blocked: ticket.revenue_blocked ?? null,
  });

  // Reset draft when ticket prop updates (prevents drift after PATCH)
  useEffect(() => {
    setDraft({
      current_time_cost_hours_per_week: ticket.current_time_cost_hours_per_week ?? null,
      employees_affected: ticket.employees_affected ?? null,
      avg_hourly_cost: ticket.avg_hourly_cost ?? null,
      current_error_rate: ticket.current_error_rate ?? null,
      revenue_blocked: ticket.revenue_blocked ?? null,
    });
  }, [ticket]);

  const [optionalOpen, setOptionalOpen] = useState(false);

  // Live computed preview (mirrors server formula for display before blur-save)
  const liveWeeklyCost =
    draft.current_time_cost_hours_per_week != null &&
    draft.employees_affected != null &&
    draft.avg_hourly_cost != null
      ? draft.current_time_cost_hours_per_week *
        draft.employees_affected *
        draft.avg_hourly_cost
      : null;

  const liveYearlyCost = liveWeeklyCost != null ? liveWeeklyCost * 52 : null;

  const liveAnnualSavings = liveYearlyCost;

  // Ghost state — show prompt when no row-1 inputs filled
  const hasAnyRoiInput = !!(
    draft.current_time_cost_hours_per_week ||
    draft.employees_affected ||
    draft.avg_hourly_cost
  );

  // Display values: use server-persisted values where available, fall back to live preview
  const displayWeeklyCost = ticket.weekly_cost ?? liveWeeklyCost;
  const displayYearlyCost = ticket.yearly_cost ?? liveYearlyCost;
  const displayAnnualSavings = ticket.annual_savings ?? liveAnnualSavings;

  // Handlers
  const handleChange = (field: string, value: number | null) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field: string, value: number | null) => {
    onUpdate({ [field]: value } as Partial<Ticket>);
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">ROI Analysis</h3>

      {/* Hero row: ROI % + Annual Savings */}
      <div className="grid grid-cols-2 gap-6 pb-2">
        <StatCell
          label="ROI"
          value={fmtPct(ticket.roi)}
          large
        />
        <StatCell
          label="Annual Savings"
          value={fmt$(displayAnnualSavings)}
          large
        />
      </div>

      {/* Ghost prompt when no inputs are filled */}
      {!hasAnyRoiInput && (
        <p className="text-xs text-slate-400 italic -mt-2">
          Add ROI inputs below to compute
        </p>
      )}

      {/* Supporting 3-cell grid */}
      <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-md">
        <StatCell label="Weekly Cost" value={fmt$(displayWeeklyCost)} />
        <StatCell label="Yearly Cost" value={fmt$(displayYearlyCost)} />
        <StatCell label="Dev Cost" value={fmt$(ticket.dev_cost)} />
      </div>

      {/* ROI Inputs section */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          ROI Inputs
        </h4>

        {/* Row 1: Hours Saved/Week, Employees Affected, Avg Hourly Cost */}
        <div className="grid grid-cols-3 gap-3">
          <RoiInput
            label="Hours Saved/Week"
            field="current_time_cost_hours_per_week"
            value={draft.current_time_cost_hours_per_week}
            min={0}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          <RoiInput
            label="Employees Affected"
            field="employees_affected"
            value={draft.employees_affected}
            min={0}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          <RoiInput
            label="Avg Hourly Cost ($)"
            field="avg_hourly_cost"
            value={draft.avg_hourly_cost}
            min={0}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </div>

        {/* Collapsible Optional Inputs */}
        <div>
          <button
            type="button"
            onClick={() => setOptionalOpen((prev) => !prev)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            {optionalOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            Optional Inputs
          </button>

          {optionalOpen && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <RoiInput
                label="Current Error Rate (0-1)"
                field="current_error_rate"
                value={draft.current_error_rate}
                min={0}
                max={1}
                step={0.01}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <RoiInput
                label="Revenue Blocked ($)"
                field="revenue_blocked"
                value={draft.revenue_blocked}
                min={0}
                onChange={handleChange}
                onBlur={handleBlur}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
