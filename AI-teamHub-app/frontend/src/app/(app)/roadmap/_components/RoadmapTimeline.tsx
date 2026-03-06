"use client";

import React, { useMemo } from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  format,
  parseISO,
  max as dateMax,
  min as dateMin,
  startOfDay,
  startOfYear,
  isSameMonth,
  isSameWeek,
  isSameYear,
  isWeekend,
} from "date-fns";
import { DepartmentSwimlane } from "@/hooks/useRoadmap";
import { Ticket } from "@/lib/api/tickets";
import { TimelineBar } from "./TimelineBar";
import type { ZoomLevel } from "./RoadmapView";

// Column widths per zoom
const YEAR_MONTH_WIDTH = 80;
const WEEK_COL_WIDTH = 48;
const DAY_COL_WIDTH = 32;

const BAR_HEIGHT = 28;
const BAR_GAP = 4;
const SWIMLANE_PADDING = 12;
const LABEL_WIDTH = 160;

const SWIMLANE_COLORS = [
  "#EFF6FF", // blue
  "#F5F3FF", // violet
  "#FEF9EC", // amber
  "#ECFDF5", // emerald
  "#FFF1F2", // rose
  "#F0FDFA", // teal
  "#FEF3C7", // yellow
  "#EEF2FF", // indigo
  "#FDF2F8", // pink
  "#F0FDF4", // green
];
const TOP_HEADER_HEIGHT = 24;
const SUB_HEADER_HEIGHT = 22;
const HEADER_HEIGHT = TOP_HEADER_HEIGHT + SUB_HEADER_HEIGHT;

interface RoadmapTimelineProps {
  swimlanes: DepartmentSwimlane[];
  timelineStart: Date;
  timelineEnd: Date;
  zoom: ZoomLevel;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

function getBarPosition(
  ticket: Ticket,
  gridStart: Date,
  pxPerDay: number,
  timelineStart: Date,
  timelineEnd: Date
) {
  const barStart = dateMax([parseISO(ticket.created_at), timelineStart]);
  const barEnd = dateMin([parseISO(ticket.due_date!), timelineEnd]);

  const leftDays = differenceInCalendarDays(barStart, gridStart);
  const barDays = Math.max(differenceInCalendarDays(barEnd, barStart), 1);

  return {
    left: leftDays * pxPerDay,
    width: barDays * pxPerDay,
  };
}

function assignRows(
  tickets: Ticket[],
  timelineStart: Date,
  timelineEnd: Date
): Map<string, number> {
  const rows = new Map<string, number>();
  const endsByRow: Date[] = [];

  for (const ticket of tickets) {
    const start = dateMax([parseISO(ticket.created_at), timelineStart]);
    const end = dateMin([parseISO(ticket.due_date!), timelineEnd]);
    let placed = false;
    for (let r = 0; r < endsByRow.length; r++) {
      if (endsByRow[r] <= start) {
        rows.set(ticket.id, r);
        endsByRow[r] = end;
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.set(ticket.id, endsByRow.length);
      endsByRow.push(end);
    }
  }
  return rows;
}

function filterVisibleSwimlanes(
  swimlanes: DepartmentSwimlane[],
  timelineStart: Date,
  timelineEnd: Date
): DepartmentSwimlane[] {
  return swimlanes
    .map((lane) => ({
      ...lane,
      tickets: lane.tickets.filter((t) => {
        if (!t.due_date) return false;
        const dueDate = parseISO(t.due_date);
        const createdAt = parseISO(t.created_at);
        return dueDate >= timelineStart && createdAt <= timelineEnd;
      }),
    }))
    .filter((lane) => lane.tickets.length > 0);
}

// ── Zoom-specific grid data ──

interface HeaderSpan {
  label: string;
  widthPx: number;
}

interface SubCell {
  label: string;
  widthPx: number;
  muted?: boolean;
}

interface GridData {
  gridStart: Date;
  pxPerDay: number;
  totalWidth: number;
  topSpans: HeaderSpan[];
  subCells: SubCell[];
  gridLines: { offset: number; strong?: boolean }[];
}

function useYearZoom(timelineStart: Date, timelineEnd: Date): GridData {
  return useMemo(() => {
    const months = eachMonthOfInterval({ start: timelineStart, end: timelineEnd });
    const gridStart = months[0];
    const totalWidth = months.length * YEAR_MONTH_WIDTH;

    // Approximate px per day based on average month
    const totalDays = differenceInCalendarDays(timelineEnd, timelineStart) || 1;
    const pxPerDay = totalWidth / totalDays;

    // Top row: years
    const years = Array.from(new Set(months.map((m) => m.getFullYear())));
    const topSpans: HeaderSpan[] = years.map((yr) => {
      const count = months.filter((m) => m.getFullYear() === yr).length;
      return { label: String(yr), widthPx: count * YEAR_MONTH_WIDTH };
    });

    // Sub row: month abbreviations
    const subCells: SubCell[] = months.map((m) => ({
      label: format(m, "MMM"),
      widthPx: YEAR_MONTH_WIDTH,
    }));

    // Grid lines at each month
    const gridLines = months.map((_, i) => ({
      offset: i * YEAR_MONTH_WIDTH,
      strong: false,
    }));

    return { gridStart, pxPerDay, totalWidth, topSpans, subCells, gridLines };
  }, [timelineStart, timelineEnd]);
}

function useWeekZoom(timelineStart: Date, timelineEnd: Date): GridData {
  return useMemo(() => {
    const weeks = eachWeekOfInterval(
      { start: timelineStart, end: timelineEnd },
      { weekStartsOn: 1 }
    );
    const gridStart = weeks[0];
    const pxPerDay = WEEK_COL_WIDTH / 7;
    const totalWidth = weeks.length * WEEK_COL_WIDTH;

    // Top row: months
    const allMonths = eachMonthOfInterval({ start: gridStart, end: timelineEnd });
    const topSpans: HeaderSpan[] = allMonths
      .map((month) => {
        const count = weeks.filter((w) => isSameMonth(w, month)).length;
        return { label: format(month, "MMM yyyy"), widthPx: count * WEEK_COL_WIDTH };
      })
      .filter((m) => m.widthPx > 0);

    // Sub row: week start dates
    const subCells: SubCell[] = weeks.map((w) => ({
      label: format(w, "d"),
      widthPx: WEEK_COL_WIDTH,
    }));

    const gridLines = weeks.map((_, i) => ({
      offset: i * WEEK_COL_WIDTH,
    }));

    return { gridStart, pxPerDay, totalWidth, topSpans, subCells, gridLines };
  }, [timelineStart, timelineEnd]);
}

function useDayZoom(timelineStart: Date, timelineEnd: Date): GridData {
  return useMemo(() => {
    const days = eachDayOfInterval({ start: timelineStart, end: timelineEnd });
    const gridStart = days[0];
    const pxPerDay = DAY_COL_WIDTH;
    const totalWidth = days.length * DAY_COL_WIDTH;

    // Top row: months
    const months = eachMonthOfInterval({ start: timelineStart, end: timelineEnd });
    const topSpans: HeaderSpan[] = months.map((month) => {
      const count = days.filter((d) => isSameMonth(d, month)).length;
      return { label: format(month, "MMMM"), widthPx: count * DAY_COL_WIDTH };
    });

    // Sub row: day numbers
    const subCells: SubCell[] = days.map((d) => ({
      label: format(d, "d"),
      widthPx: DAY_COL_WIDTH,
      muted: isWeekend(d),
    }));

    const gridLines = days.map((d, i) => ({
      offset: i * DAY_COL_WIDTH,
      strong: false,
    }));

    return { gridStart, pxPerDay, totalWidth, topSpans, subCells, gridLines };
  }, [timelineStart, timelineEnd]);
}

// ── Main component ──

export function RoadmapTimeline({
  swimlanes,
  timelineStart,
  timelineEnd,
  zoom,
  scrollRef,
}: RoadmapTimelineProps) {
  const yearGrid = useYearZoom(timelineStart, timelineEnd);
  const weekGrid = useWeekZoom(timelineStart, timelineEnd);
  const dayGrid = useDayZoom(timelineStart, timelineEnd);

  const grid = zoom === "year" ? yearGrid : zoom === "week" ? weekGrid : dayGrid;

  const todayPx = useMemo(() => {
    const today = startOfDay(new Date());
    const days = differenceInCalendarDays(today, grid.gridStart);
    const px = days * grid.pxPerDay;
    if (days < 0 || px > grid.totalWidth) return null;
    return LABEL_WIDTH + px;
  }, [grid.gridStart, grid.pxPerDay, grid.totalWidth]);

  const visibleSwimlanes = useMemo(
    () => filterVisibleSwimlanes(swimlanes, timelineStart, timelineEnd),
    [swimlanes, timelineStart, timelineEnd]
  );

  if (visibleSwimlanes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: "#9B9A97" }}>
          No scheduled tickets to display in this range.
        </p>
      </div>
    );
  }

  const colWidth =
    zoom === "year" ? YEAR_MONTH_WIDTH : zoom === "week" ? WEEK_COL_WIDTH : DAY_COL_WIDTH;

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-x-auto overflow-y-auto relative border-t"
      style={{ borderColor: "#E9E9E6" }}
    >
      <div
        style={{ width: LABEL_WIDTH + grid.totalWidth, minHeight: "100%" }}
        className="relative"
      >
        {/* ── Header ── */}
        <div
          className="sticky top-0 z-20"
          style={{ background: "#F7F7F5", borderBottom: "1px solid #E9E9E6" }}
        >
          {/* Top row */}
          <div className="flex" style={{ height: TOP_HEADER_HEIGHT }}>
            <div
              className="flex-shrink-0 sticky left-0 z-30"
              style={{
                width: LABEL_WIDTH,
                background: "#F7F7F5",
                borderRight: "1px solid #E9E9E6",
              }}
            />
            {grid.topSpans.map((span, i) => (
              <div
                key={i}
                className="flex-shrink-0 flex items-center px-2 text-xs font-medium"
                style={{
                  width: span.widthPx,
                  color: "#37352F",
                  borderRight: "1px solid #E9E9E6",
                }}
              >
                {span.label}
              </div>
            ))}
          </div>

          {/* Sub row */}
          <div className="flex" style={{ height: SUB_HEADER_HEIGHT }}>
            <div
              className="flex-shrink-0 sticky left-0 z-30"
              style={{
                width: LABEL_WIDTH,
                background: "#F7F7F5",
                borderRight: "1px solid #E9E9E6",
              }}
            />
            {grid.subCells.map((cell, i) => (
              <div
                key={i}
                className="flex-shrink-0 flex items-center justify-center text-[10px]"
                style={{
                  width: cell.widthPx,
                  color: cell.muted ? "#CFCDC9" : "#9B9A97",
                  borderRight: "1px solid #F0F0EE",
                }}
              >
                {cell.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Today marker ── */}
        {todayPx !== null && (
          <div
            data-today-marker
            className="absolute bottom-0 z-10 pointer-events-none"
            style={{
              top: HEADER_HEIGHT,
              left: todayPx,
              width: 2,
              background: "rgba(239, 68, 68, 0.5)",
            }}
          />
        )}

        {/* ── Swimlanes ── */}
        {visibleSwimlanes.map((lane, laneIdx) => {
          const rows = assignRows(lane.tickets, timelineStart, timelineEnd);
          const maxRow = Math.max(...Array.from(rows.values()), 0);
          const swimlaneHeight =
            (maxRow + 1) * (BAR_HEIGHT + BAR_GAP) + SWIMLANE_PADDING * 2;
          const laneBg = SWIMLANE_COLORS[laneIdx % SWIMLANE_COLORS.length];

          return (
            <div
              key={lane.departmentId}
              className="flex"
              style={{
                height: swimlaneHeight,
                borderBottom: "1px solid #E9E9E6",
              }}
            >
              {/* Department label */}
              <div
                className="flex-shrink-0 sticky left-0 z-10 flex items-start px-3 pt-3"
                style={{
                  width: LABEL_WIDTH,
                  background: laneBg,
                  borderRight: "1px solid #E9E9E6",
                }}
              >
                <span
                  className="text-xs font-medium truncate"
                  style={{ color: "#37352F" }}
                >
                  {lane.departmentName}
                </span>
              </div>

              {/* Timeline area */}
              <div className="relative flex-1" style={{ width: grid.totalWidth }}>
                {/* Grid lines */}
                {grid.gridLines.map((line, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0"
                    style={{
                      left: line.offset,
                      width: 1,
                      background: line.strong ? "#E9E9E6" : "#F0F0EE",
                    }}
                  />
                ))}

                {/* Weekend shading (day zoom only) */}
                {zoom === "day" &&
                  grid.subCells.map(
                    (cell, i) =>
                      cell.muted && (
                        <div
                          key={`bg-${i}`}
                          className="absolute top-0 bottom-0"
                          style={{
                            left: i * colWidth,
                            width: colWidth,
                            background: "rgba(0,0,0,0.015)",
                          }}
                        />
                      )
                  )}

                {/* Ticket bars */}
                {lane.tickets.map((ticket) => {
                  const pos = getBarPosition(
                    ticket,
                    grid.gridStart,
                    grid.pxPerDay,
                    timelineStart,
                    timelineEnd
                  );
                  const row = rows.get(ticket.id) ?? 0;
                  const top =
                    SWIMLANE_PADDING + row * (BAR_HEIGHT + BAR_GAP);

                  return (
                    <TimelineBar
                      key={ticket.id}
                      ticket={ticket}
                      left={pos.left}
                      width={pos.width}
                      top={top}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
