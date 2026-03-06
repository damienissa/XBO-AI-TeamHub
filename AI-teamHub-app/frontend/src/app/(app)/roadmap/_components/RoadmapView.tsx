"use client";

import { useState, useCallback, useRef } from "react";
import { addMonths, startOfDay } from "date-fns";
import { useRoadmap } from "@/hooks/useRoadmap";
import { TicketDetailModal } from "@/app/(app)/board/_components/TicketDetailModal";
import { RoadmapFilterBar } from "./RoadmapFilterBar";
import { RoadmapTimeline } from "./RoadmapTimeline";
import { UnscheduledSection } from "./UnscheduledSection";

export type ZoomLevel = "year" | "week" | "day";

function getDefaultRange() {
  const today = startOfDay(new Date());
  return {
    start: today,
    end: addMonths(today, 12),
  };
}

export function RoadmapView() {
  const [range] = useState(getDefaultRange);
  const [zoom, setZoom] = useState<ZoomLevel>("day");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { swimlanes, unscheduled, departments, isPending, isError } = useRoadmap();

  const scrollToToday = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const marker = container.querySelector<HTMLElement>("[data-today-marker]");
    if (marker) {
      container.scrollLeft = marker.offsetLeft - 200;
    } else {
      container.scrollLeft = 0;
    }
  }, []);

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-20">
        <p className="text-sm" style={{ color: "#9B9A97" }}>
          Failed to load roadmap data.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm px-3 py-1.5 rounded-md"
          style={{ background: "#2383E2", color: "#fff" }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <RoadmapFilterBar
        departments={departments ?? []}
        zoom={zoom}
        onZoomChange={setZoom}
        onToday={scrollToToday}
      />

      {isPending ? (
        <div className="flex-1 p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 items-center">
                <div
                  className="h-5 w-24 rounded animate-pulse"
                  style={{ background: "#E9E9E6" }}
                />
                <div className="flex-1 flex gap-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div
                      key={j}
                      className="h-7 rounded animate-pulse"
                      style={{
                        background: "#E9E9E6",
                        width: `${80 + Math.random() * 120}px`,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <RoadmapTimeline
            swimlanes={swimlanes}
            timelineStart={range.start}
            timelineEnd={range.end}
            zoom={zoom}
            scrollRef={scrollRef}
          />

          {unscheduled.length > 0 && (
            <UnscheduledSection tickets={unscheduled} />
          )}
        </>
      )}

      <TicketDetailModal />
    </div>
  );
}
