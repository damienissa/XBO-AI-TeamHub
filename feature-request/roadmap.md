# Feature Request: Roadmap View

## Summary

Add a Roadmap section to XBO AI TeamHub — a horizontal Gantt-style timeline that visualizes all tickets by their due dates across a 12-month window (starting from today), grouped into department swimlanes with three zoom levels (Year, Week, Day).

## Motivation

The existing Kanban Board excels at showing current workflow status but lacks a temporal perspective. Teams need to:
- Visualize upcoming deadlines across the entire organization
- Identify scheduling conflicts and gaps
- Plan department workload distribution over months
- Spot unscheduled tickets that need due dates assigned

## User Stories

1. **As a project manager**, I want to see all tickets laid out on a timeline so I can identify scheduling bottlenecks.
2. **As a department lead**, I want to filter the roadmap by my department so I can plan my team's workload.
3. **As an executive**, I want to see a high-level view of all departments' work timelines to make resource allocation decisions.
4. **As a team member**, I want to click a ticket on the roadmap to view and edit its details.

## Visual Design

### Layout

```
+------------------------------------------------------------------+
| [All departments v]              [Year|Week|Day]           Today |
+------------------------------------------------------------------+
|            | Sep  | Oct  | Nov  | Dec  | Jan  | Feb  | Mar  | ...
+------------+------+------+------+------+------+------+------+----+
| R&D        | ████████████████  Ticket A                          |
|            |       ████████████████████  Ticket B                 |
+------------+------+------+------+------+------+------+------+----+
| Design     | ████  Ticket C                                      |
|            |              ████████████████████████  Ticket D      |
+------------+------+------+------+------+------+------+------+----+
| Finance    |                    ██████  Ticket E                  |
+------------+------+------+------+------+------+------+------+----+
                              |  (today marker - red vertical line)
+------------------------------------------------------------------+
| v Unscheduled (5)                                                |
| [Card A] [Card B] [Card C] [Card D] [Card E]                    |
+------------------------------------------------------------------+
```

### Component Hierarchy

- **RoadmapView** — Root orchestrator
  - **RoadmapFilterBar** — Department dropdown, zoom toggle (Year/Week/Day), Today button
  - **RoadmapTimeline** — Horizontal Gantt chart
    - **TimelineBar** — Individual ticket bars (one per ticket)
  - **UnscheduledSection** — Collapsible bottom section for tickets without due dates
  - **TicketDetailModal** — Reused from Board (opens on ticket click)

## Data Model

No new database fields or backend endpoints required. Reuses existing:

| Field | Usage |
|-------|-------|
| `created_at` | Bar start date (left edge) |
| `due_date` | Bar end date (right edge) |
| `department` | Swimlane grouping |
| `department_id` | Department filter |
| `title` | Bar label text |
| `priority` | Bar left-border color |
| `status_column` | Bar background color + tooltip info |
| `owner` | Tooltip info |

**API**: Uses existing `GET /api/board?department_id=<uuid>` endpoint.

## Filter Requirements

- **Department dropdown**: Single-select, defaults to "All departments"
- Filter state persisted in URL query params via `nuqs` (shareable/bookmarkable)
- Example: `/roadmap?department=<uuid>`

## Interaction Design

| Action | Behavior |
|--------|----------|
| **Click ticket bar** | Opens TicketDetailModal (same as Board) |
| **Hover ticket bar** | Shows tooltip: title, owner, status, priority, due date |
| **Zoom toggle** | Switch between Year, Week, Day views (default: Day) |
| **Click "Today"** | Scrolls timeline to the current date |
| **Click "Unscheduled" header** | Toggles collapse/expand of unscheduled section |
| **Click unscheduled card** | Opens TicketDetailModal |
| **Scroll horizontally** | Pans the timeline; department labels stay pinned left |

## Visual Encoding

| Element | Encoding |
|---------|----------|
| Bar background color | Status column (Backlog=gray, Discovery=purple, In Progress=orange, Review/QA=blue, Done=green) |
| Bar left border (3px) | Priority (red=critical, orange=high, yellow=medium, slate=low) |
| Red ring on bar | Overdue indicator (due_date < today and status != Done) |
| Red vertical line | Today marker |
| Bar width | Duration from created_at to due_date |
| Bar vertical position | Stacked to avoid overlap within department swimlane |
| Department label background | Distinct pastel color per department (cycling palette) |

## Edge Cases

1. **No due date**: Ticket appears in "Unscheduled" section, not on timeline
2. **Overlapping tickets**: Stacked vertically within the department swimlane (swimlane height expands)
3. **Very short duration**: Minimum bar width of 30px ensures clickability
4. **Bar extends beyond visible range**: Clamped to timeline boundaries
5. **Empty departments**: Swimlane not rendered if department has no scheduled tickets
6. **No tickets at all**: "No scheduled tickets to display" message

## Acceptance Criteria

- [ ] "Roadmap" appears in sidebar navigation between "Board" and "Dashboard"
- [ ] `/roadmap` route is protected (redirects to login if unauthenticated)
- [ ] Timeline displays 12 months starting from today
- [ ] Tickets with due dates appear as horizontal bars grouped by department
- [ ] Department labels are sticky (visible while scrolling horizontally)
- [ ] Month headers are sticky (visible while scrolling vertically)
- [ ] Today marker (red vertical line) is visible on the timeline
- [ ] Department filter dropdown works and persists in URL
- [ ] Clicking a bar opens the TicketDetailModal with correct ticket data
- [ ] Hovering a bar shows tooltip with ticket metadata
- [ ] Zoom toggle switches between Year, Week, and Day views (default: Day)
- [ ] "Today" button scrolls the timeline to the current date
- [ ] Unscheduled section shows tickets without due dates
- [ ] Unscheduled section is collapsible
- [ ] Loading skeleton displays while data is fetching
- [ ] Error state shows retry button

## Technical Notes

- **No new dependencies**: Uses existing `date-fns`, `tippy.js`, `nuqs`, `@tanstack/react-query`
- **No backend changes**: Frontend-only feature using `GET /api/board`
- **Shared cache**: Same React Query cache key as Board, so switching between views is instant
- **Custom CSS Gantt**: Built with absolute positioning, no heavy charting library
