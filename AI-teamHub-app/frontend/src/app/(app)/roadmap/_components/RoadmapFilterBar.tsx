"use client";

import { useQueryStates, parseAsString } from "nuqs";
import type { ZoomLevel } from "./RoadmapView";

const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
  { value: "year", label: "Year" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

interface RoadmapFilterBarProps {
  departments: { id: string; slug: string; name: string }[];
  zoom: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  onToday: () => void;
}

export function RoadmapFilterBar({
  departments,
  zoom,
  onZoomChange,
  onToday,
}: RoadmapFilterBarProps) {
  const [filters, setFilters] = useQueryStates({
    department: parseAsString,
  });

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 border-b flex-shrink-0"
      style={{ borderColor: "#E9E9E6", background: "#FAFAF9" }}
    >
      {/* Department filter */}
      <select
        className="text-sm rounded-md border px-2 py-1.5 bg-white"
        style={{ borderColor: "#E9E9E6", color: "#37352F" }}
        value={filters.department ?? ""}
        onChange={(e) =>
          setFilters({ department: e.target.value || null })
        }
      >
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      {filters.department && (
        <button
          className="text-xs px-2 py-1 rounded hover:bg-black/5 transition-colors"
          style={{ color: "#9B9A97" }}
          onClick={() => setFilters({ department: null })}
        >
          Clear
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Zoom toggle */}
      <div
        className="flex items-center rounded-md border overflow-hidden"
        style={{ borderColor: "#E9E9E6" }}
      >
        {ZOOM_OPTIONS.map((opt, i) => (
          <button
            key={opt.value}
            className="px-3 py-1 text-xs transition-colors"
            style={{
              background: zoom === opt.value ? "#EFEDEA" : "transparent",
              color: zoom === opt.value ? "#37352F" : "#9B9A97",
              fontWeight: zoom === opt.value ? 500 : 400,
              borderLeft: i > 0 ? "1px solid #E9E9E6" : undefined,
            }}
            onClick={() => onZoomChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Today */}
      <button
        onClick={onToday}
        className="text-xs px-2.5 py-1 rounded hover:bg-black/5 transition-colors"
        style={{ color: "#2383E2" }}
      >
        Today
      </button>
    </div>
  );
}
