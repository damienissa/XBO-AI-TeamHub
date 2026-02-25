# Phase 4: ROI Estimation and Executive Dashboard - Research

**Researched:** 2026-02-25
**Domain:** Analytics dashboard (Recharts), ROI computation, PostgreSQL aggregation, inline editing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**ROI panel location and layout**
- Always-visible section on the ticket detail (not accordion, not tabs) — same presence as comments and subtasks
- ROI % is the headline number, annual savings is secondary
- Supporting numbers (weekly cost, yearly cost, dev cost, adjusted ROI) shown in a smaller grid below the hero stats
- When no ROI inputs are filled: show the panel structure with dashes for values and a subtle "Add ROI inputs to compute" prompt — never hide the panel entirely

**ROI panel editability**
- ROI inputs are editable inline on the ticket detail (same as urgency or due date)
- Live preview: computed values (ROI %, annual savings, etc.) update in real time as the user types
- Save triggers on field blur (no explicit save button needed for individual fields)
- Portal submissions still require ROI inputs at submission time

**ROI inputs layout on ticket detail**
- ROI inputs NOT on QuickAdd form — only editable on the ticket detail after creation
- Two logical rows: Row 1 — core cost inputs (hours saved/week, employees affected, avg hourly cost); Row 2 — adjustment factors (expected savings rate, risk probability, strategic value 1–5)
- Optional fields (error rate, revenue blocked) in a secondary collapsible within the ROI section

**Dashboard access and navigation**
- Accessible to all authenticated users (admin + member) — no role restriction
- Top-level sidebar nav item: "Dashboard" — same level as Board and Portal
- Layout: 4 KPI cards in a row at the top, then two-column row (workload bar chart left, dept breakdown table right), then column time breakdown row at the bottom

**Dashboard KPI definitions**
- **Overdue count**: tickets where `due_date < today` AND column is NOT Done
- **Throughput**: tickets moved to Done per week
- **Avg cycle time**: created_at → done timestamp across completed tickets
- **Open ticket count**: all tickets not in Done

**Throughput trend chart**
- Last 8 weeks of data (2 months)
- Recharts LineChart or AreaChart (Claude's discretion on chart type)

**Workload chart**
- Shows sum of `effort_estimate` on tickets where user is owner AND column is NOT Backlog AND column is NOT Done (active tickets only)
- Recharts BarChart, one bar per team member

**Bottleneck highlight**
- Each column has a card showing avg time tickets spent there
- The column with the highest avg time gets a red/orange accent (border or background) — no badge label

### Claude's Discretion
- Throughput chart type: LineChart or AreaChart — recommend AreaChart (fills area under the curve, more readable for sparse weekly data)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Dashboard page shows KPI cards: open ticket count, throughput (done per week), avg cycle time (created→done), overdue count | Single aggregation endpoint; computed in SQL via GROUP BY and EXTRACT(epoch); displayed as 4-card row |
| DASH-02 | Avg time per column — for each of the 5 columns, show the average time tickets spent in that column | `column_history` table already records `entered_at`/`exited_at`; avg EXTRACT(epoch, exited_at - entered_at) per column; NULL exited_at rows excluded |
| DASH-03 | Bottleneck column — column with highest avg time is highlighted | Computed client-side from DASH-02 data; red/orange border applied to max-avg card |
| DASH-04 | Workload per user — bar chart showing sum of effort_hours on active tickets per team member | Recharts BarChart; query GROUP BY owner_id WHERE status_column NOT IN ('Backlog', 'Done') AND effort_estimate IS NOT NULL |
| DASH-05 | Department breakdown table — ticket counts and avg cycle time per department | Single subquery; GROUP BY department_id with JOIN to departments; avg cycle time uses same EXTRACT(epoch) pattern |
| DASH-06 | Dashboard data served from a single aggregation endpoint using PostgreSQL window functions | One `/api/dashboard` endpoint returning all KPIs, column times, workload, dept breakdown, throughput trend in one response |
| DASH-07 | KPI charts use Recharts (BarChart for workload, LineChart or AreaChart for throughput trend) | Recharts 3.x; `"use client"` directive; `ResponsiveContainer width="100%"`; install `recharts` package |
| ROI-01 | ROI fields stored on ticket: current_time_cost_hours_per_week, employees_affected, avg_hourly_cost, current_error_rate, revenue_blocked, strategic_value, expected_savings_rate, risk_probability | New Alembic migration replacing Phase 3 stub columns; full set of 8 input fields; computed fields persisted |
| ROI-02 | Computed fields (persisted): weekly_cost, yearly_cost, annual_savings, dev_cost, roi, adjusted_roi with formulas | Computed server-side on PATCH `/api/tickets/{id}`; persisted to DB columns; triggered on any ROI input change |
| ROI-03 | `internal_ai_team_hourly_rate` is a server-side config value (env var, default 75) | Already implemented: `settings.AI_TEAM_HOURLY_RATE = 75.0` in `config.py`; already exposed via `/api/config` |
| ROI-04 | ROI panel displayed on ticket detail with computed values | New `RoiPanel` component added to `TicketDetailModal`; always-visible section; hero stats + supporting grid |
| ROI-05 | Division-by-zero handled — roi stored as NULL, displayed as "Insufficient data" | Server-side: check `dev_cost == 0` before division; return NULL; frontend: display "—" |
| ROI-06 | ROI inputs required on portal submissions, optional on direct board creation | Portal already enforces at-least-one-ROI validation; Phase 4 portal form must be updated to the NEW ROI input fields (not the Phase 3 stub fields) |
</phase_requirements>

---

## Summary

Phase 4 has two distinct workstreams that share a backend migration: (1) full ROI field set on the `tickets` table replacing the Phase 3 stubs, with server-side computation on every ticket update, and (2) an executive analytics dashboard backed by a single PostgreSQL aggregation endpoint.

The existing codebase is well-prepared. `AI_TEAM_HOURLY_RATE` already lives in `settings` and is exposed via `GET /api/config`. The `column_history` table (with `entered_at`/`exited_at`) is the source for all "avg time per column" and "cycle time" metrics. The `tickets` table has Phase 3 stub ROI columns (`hours_saved_per_month`, `cost_savings_per_month`, `revenue_impact`) that Phase 4 replaces with the full set defined in ROI-01. Recharts 3.7.0 is not yet installed; it must be added to the frontend.

The inline-edit pattern in `TicketDetailModal.tsx` (blur-to-save, `updateMutation`, debounced callbacks) is the established pattern; the ROI panel follows it exactly. The dashboard page is a new route (`/dashboard`) under the existing `(app)` group, which already provides auth and sidebar layout.

**Primary recommendation:** Implement as three sequential plans — (1) DB migration + backend ROI computation, (2) ROI panel on ticket detail + portal form update, (3) dashboard page with aggregation endpoint + Recharts charts.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^3.7.0 | BarChart, AreaChart — locked by DASH-07 | Project decision; mature React+D3 library, TypeScript support |
| sqlalchemy[asyncio] | >=2.0 (already installed) | Aggregation queries via `func.extract`, `func.avg`, `date_trunc` | Already in use throughout backend |
| alembic | >=1.13 (already installed) | DB migration to add full ROI fields | Already powering all prior migrations |
| @tanstack/react-query | ^5.90.21 (already installed) | Dashboard data fetching with staleTime | Already used for board, ticket detail |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| use-debounce | ^10.1.0 (already installed) | Debounced saves on ROI text inputs | ROI inputs with live preview need debounce before persisting |
| date-fns | ^4.1.0 (already installed) | Format week labels for throughput chart | Already used in TicketDetailModal for date formatting |
| lucide-react | ^0.575.0 (already installed) | Icons in KPI cards (TrendingUp, Clock, AlertCircle, CheckCircle2) | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | chart.js / victory / visx | Locked decision — recharts is the project choice |
| single aggregation endpoint | multiple endpoints | DASH-06 locks to single endpoint |

**Installation (frontend only — new):**
```bash
npm install recharts
```

No backend packages needed — all aggregation via existing SQLAlchemy + PostgreSQL.

---

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── alembic/versions/
│   └── XXXX_phase4_roi_dashboard.py   # New migration — replaces stub ROI cols
├── app/
│   ├── routers/
│   │   └── dashboard.py               # GET /api/dashboard — single aggregation endpoint
│   ├── schemas/
│   │   └── dashboard.py               # DashboardOut schema with nested structures
│   └── services/
│       └── roi.py                     # ROI computation helper (compute_roi_fields)

frontend/src/app/(app)/
├── dashboard/
│   └── page.tsx                       # Dashboard page — "use client" or server shell
├── board/_components/
│   ├── RoiPanel.tsx                   # ROI panel added to TicketDetailModal
│   └── TicketDetailModal.tsx          # Extended with RoiPanel section
```

### Pattern 1: Server-Side ROI Computation on Every PATCH

**What:** When any ROI input field changes in a `PATCH /api/tickets/{id}` request, the backend recomputes all derived fields and persists them atomically.
**When to use:** Guarantees DB is always the source of truth for computed values; eliminates client-side drift.

```python
# Source: project pattern — services/roi.py
def compute_roi_fields(
    current_time_cost_hours_per_week: float | None,
    employees_affected: float | None,
    avg_hourly_cost: float | None,
    expected_savings_rate: float | None,
    risk_probability: float | None,
    effort_estimate: float | None,
    ai_team_hourly_rate: float,
) -> dict:
    """
    Compute all derived ROI fields. Returns a dict of column values.
    All None-guards: missing inputs yield NULL for downstream columns.
    """
    result = {}

    weekly_cost = None
    if all(v is not None for v in [current_time_cost_hours_per_week, employees_affected, avg_hourly_cost]):
        weekly_cost = current_time_cost_hours_per_week * employees_affected * avg_hourly_cost

    yearly_cost = weekly_cost * 52 if weekly_cost is not None else None

    annual_savings = None
    if yearly_cost is not None and expected_savings_rate is not None:
        annual_savings = yearly_cost * expected_savings_rate

    dev_cost = None
    if effort_estimate is not None:
        dev_cost = effort_estimate * ai_team_hourly_rate

    roi = None
    if annual_savings is not None and dev_cost is not None and dev_cost != 0:
        roi = (annual_savings - dev_cost) / dev_cost
    # If dev_cost == 0: roi stays NULL (ROI-05 guard)

    adjusted_roi = None
    if roi is not None and risk_probability is not None:
        adjusted_roi = roi * (1 - risk_probability)

    result["weekly_cost"] = weekly_cost
    result["yearly_cost"] = yearly_cost
    result["annual_savings"] = annual_savings
    result["dev_cost"] = dev_cost
    result["roi"] = roi
    result["adjusted_roi"] = adjusted_roi
    return result
```

### Pattern 2: Alembic Migration — Replace Phase 3 ROI Stubs

**What:** Phase 3 added 3 stub columns. Phase 4 drops them and adds the full 8 input + 6 computed columns.
**When to use:** Single migration, `op.drop_column` for stubs + `op.add_column` for the full set.

```python
# Source: project convention — alembic/versions/XXXX_phase4_roi_dashboard.py
def upgrade() -> None:
    # Drop Phase 3 stub ROI columns
    op.drop_column('tickets', 'hours_saved_per_month')
    op.drop_column('tickets', 'cost_savings_per_month')
    op.drop_column('tickets', 'revenue_impact')

    # Add full ROI input fields (ROI-01)
    op.add_column('tickets', sa.Column('current_time_cost_hours_per_week', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('employees_affected', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('avg_hourly_cost', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('current_error_rate', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('revenue_blocked', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('strategic_value', sa.Integer(), nullable=True))
    op.add_column('tickets', sa.Column('expected_savings_rate', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('risk_probability', sa.Float(), nullable=True))

    # Add computed/persisted ROI output fields (ROI-02)
    op.add_column('tickets', sa.Column('weekly_cost', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('yearly_cost', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('annual_savings', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('dev_cost', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('roi', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('adjusted_roi', sa.Float(), nullable=True))
```

### Pattern 3: Dashboard Aggregation Endpoint

**What:** `GET /api/dashboard` runs multiple SQL queries and returns all dashboard data in one response. PostgreSQL handles all computation server-side.
**When to use:** DASH-06 requirement; avoids N+1 round trips from the frontend.

```python
# Source: project pattern — routers/dashboard.py
# All metrics in one response object
@router.get("/dashboard", response_model=DashboardOut)
async def get_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> DashboardOut:
    today = date.today()

    # 1. KPI: open ticket count
    open_count = await db.scalar(
        select(func.count(Ticket.id)).where(Ticket.status_column != StatusColumn.Done)
    )

    # 2. KPI: overdue count
    overdue_count = await db.scalar(
        select(func.count(Ticket.id)).where(
            Ticket.due_date < today,
            Ticket.status_column != StatusColumn.Done,
        )
    )

    # 3. KPI: throughput (last 7 days, current week)
    # (full throughput trend computed in step 6)

    # 4. KPI: avg cycle time (seconds → hours for display)
    # Uses column_history where column = 'Done' and exited_at IS NULL (currently in Done)
    # Cycle time = EXTRACT(epoch FROM (ch.entered_at - t.created_at))
    done_ch = aliased(ColumnHistory)
    cycle_time_result = await db.scalar(
        select(
            func.avg(
                func.extract("epoch", done_ch.entered_at - Ticket.created_at)
            )
        )
        .join(done_ch, (done_ch.ticket_id == Ticket.id) & (done_ch.column == "Done"))
        .where(Ticket.status_column == StatusColumn.Done)
    )
    avg_cycle_time_hours = (cycle_time_result / 3600) if cycle_time_result else None

    # 5. Avg time per column (DASH-02)
    # Only completed column spans (exited_at IS NOT NULL)
    col_time_rows = await db.execute(
        select(
            ColumnHistory.column,
            func.avg(
                func.extract("epoch", ColumnHistory.exited_at - ColumnHistory.entered_at)
            ).label("avg_seconds"),
        )
        .where(ColumnHistory.exited_at.is_not(None))
        .group_by(ColumnHistory.column)
    )
    column_times = [
        {"column": row.column, "avg_hours": row.avg_seconds / 3600}
        for row in col_time_rows
    ]

    # 6. Throughput trend — last 8 weeks
    eight_weeks_ago = datetime.now(timezone.utc) - timedelta(weeks=8)
    throughput_rows = await db.execute(
        select(
            func.date_trunc("week", ColumnHistory.entered_at).label("week_start"),
            func.count(ColumnHistory.ticket_id).label("count"),
        )
        .where(
            ColumnHistory.column == "Done",
            ColumnHistory.entered_at >= eight_weeks_ago,
        )
        .group_by(func.date_trunc("week", ColumnHistory.entered_at))
        .order_by(func.date_trunc("week", ColumnHistory.entered_at))
    )
    throughput_trend = [
        {"week": row.week_start.isoformat(), "count": row.count}
        for row in throughput_rows
    ]

    # 7. Workload per user (DASH-04)
    workload_rows = await db.execute(
        select(
            Ticket.owner_id,
            func.sum(Ticket.effort_estimate).label("total_hours"),
        )
        .where(
            Ticket.owner_id.is_not(None),
            Ticket.effort_estimate.is_not(None),
            Ticket.status_column.not_in([StatusColumn.Backlog, StatusColumn.Done]),
        )
        .group_by(Ticket.owner_id)
    )
    # Enrich with user names via separate query or selectinload

    # 8. Department breakdown (DASH-05)
    # ...

    return DashboardOut(...)
```

### Pattern 4: Recharts AreaChart with ResponsiveContainer (throughput trend)

**What:** Client component wrapping Recharts in ResponsiveContainer. Must be in a `"use client"` file.
**When to use:** All Recharts charts — D3 requires DOM access, cannot SSR.

```typescript
// Source: recharts.github.io/en-US/api/ + Next.js 14 verified pattern
"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

interface WeeklyThroughput {
  week: string;   // ISO date string, formatted to "Mon DD" for display
  count: number;
}

interface ThroughputChartProps {
  data: WeeklyThroughput[];
}

export function ThroughputChart({ data }: ThroughputChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94a3b8" }} />
        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
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
  );
}
```

### Pattern 5: Recharts BarChart (workload per user)

```typescript
// Source: recharts.github.io/en-US/api/BarChart + verified pattern
"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

interface UserWorkload {
  name: string;          // user full_name
  hours: number;         // sum of effort_estimate
}

export function WorkloadChart({ data }: { data: UserWorkload[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          label={{ value: "hours", angle: -90, position: "insideLeft", fontSize: 10 }}
        />
        <Tooltip />
        <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### Pattern 6: Inline ROI Input with Live Preview

**What:** ROI inputs follow the blur-to-save pattern used throughout `TicketDetailModal`. Live preview computed from local state before save.
**When to use:** All 8 ROI input fields in the ROI panel section of ticket detail.

```typescript
// Source: project pattern — TicketDetailModal.tsx (blur-to-save, useDebouncedCallback)
// Live preview: compute locally, save on blur
const [roiDraft, setRoiDraft] = useState({
  current_time_cost_hours_per_week: ticket.current_time_cost_hours_per_week,
  employees_affected: ticket.employees_affected,
  avg_hourly_cost: ticket.avg_hourly_cost,
  expected_savings_rate: ticket.expected_savings_rate,
  risk_probability: ticket.risk_probability,
});

// Derived from draft (live preview — no server round trip)
const liveWeeklyCost =
  (roiDraft.current_time_cost_hours_per_week ?? 0) *
  (roiDraft.employees_affected ?? 0) *
  (roiDraft.avg_hourly_cost ?? 0);

// On blur: persist to server
const handleRoiBlur = (field: string, value: number | null) => {
  updateMutation.mutate({ [field]: value });
};
```

### Anti-Patterns to Avoid

- **Recharts without "use client":** Recharts uses D3 which requires DOM access — will throw `TypeError: Super expression must either be null or a function` in Next.js App Router if rendered server-side. Every file importing Recharts must have `"use client"`.
- **Recharts ResponsiveContainer with zero height parent:** ResponsiveContainer requires the parent element to have an explicit height. If the parent has `height: 0` or `height: auto` with no content, the chart will not render. Always set an explicit pixel height on ResponsiveContainer (`height={200}`) not just `height="100%"` when the parent has no fixed height.
- **Computing ROI client-side only:** Live preview is fine for UX, but the persisted DB values must come from server-side computation (ROI-02 requirement). Never skip the server-side recompute on PATCH.
- **NULL division without guard:** If `dev_cost = 0`, `roi` must be stored as `NULL`, not `Infinity` or `NaN`. Python's `/` operator raises `ZeroDivisionError` on `0`; use explicit guard.
- **Avg cycle time using `updated_at`:** Use the `column_history` row where `column = 'Done'` `entered_at` (when ticket arrived in Done), not `ticket.updated_at` (which changes on any edit after Done).
- **Throughput counting current open ColumnHistory rows:** Throughput for Done counts tickets that ENTERED the Done column — filter `column_history` where `column = 'Done'` regardless of `exited_at` status. An open (NULL exited_at) Done row means the ticket is still in Done, which is correct to count.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive chart sizing | Manual resize listener + SVG width state | `recharts.ResponsiveContainer` | Built-in, handles all edge cases including orientation changes |
| Bar/area chart rendering | Canvas or SVG drawing code | `recharts.BarChart`, `recharts.AreaChart` | D3 under the hood; handles ticks, tooltips, animation |
| Weekly date bucketing | JavaScript date math | `PostgreSQL date_trunc('week', ...)` | Server-side is one line; avoids timezone bugs in JS |
| Average interval computation | JS arithmetic on timestamps from API | `PostgreSQL EXTRACT(epoch FROM interval)` | Avoids float precision issues; computed correctly for NULLs |
| Tooltip formatting | Custom hover state machine | `recharts.Tooltip` with `formatter` prop | Built-in hover state management |

**Key insight:** All dashboard aggregation belongs in SQL. Pushing GROUP BY / AVG / date_trunc to PostgreSQL is dramatically faster and eliminates the need to transfer all ticket rows to the backend Python layer for aggregation.

---

## Common Pitfalls

### Pitfall 1: Phase 3 ROI Stub Columns Still Present in Portal Form

**What goes wrong:** The portal form at `frontend/src/app/(app)/portal/[dept]/page.tsx` currently submits `hours_saved_per_month`, `cost_savings_per_month`, `revenue_impact` — the Phase 3 stub fields. After Phase 4 migration drops those columns, portal submissions will fail with `422 Unprocessable Entity` or silently send fields the backend ignores.

**Why it happens:** Phase 3 form was built against the stub schema deliberately; Phase 4 replaces it.

**How to avoid:** In the same plan that adds the migration, update the portal form's Zod schema and field names to match the new ROI-01 field names (`current_time_cost_hours_per_week`, `employees_affected`, `avg_hourly_cost`). Ticket `TicketCreate` schema on the backend must also accept the new fields.

**Warning signs:** Portal submission returns 422, or board tickets show no ROI values after portal submission.

### Pitfall 2: Recharts Renders Nothing in Flex/Grid Parent Without Explicit Height

**What goes wrong:** `<ResponsiveContainer width="100%" height="100%">` inside a flex child with no explicit height renders an empty SVG of 0px.

**Why it happens:** ResponsiveContainer reads the parent's computed height. If parent is `display: flex` with `flex: 1` and no fixed height ancestor, computed height is 0.

**How to avoid:** Always set `height={N}` as a pixel value on `ResponsiveContainer` when the surrounding layout doesn't have a fixed height. The KPI chart wrappers should use `height={200}` or `height={220}` directly.

**Warning signs:** Chart renders, no error, but chart area is invisible / zero height.

### Pitfall 3: avg_cycle_time Using Wrong Timestamp Source

**What goes wrong:** Computing cycle time as `done_at - created_at` using `ticket.updated_at` gives incorrect results because tickets are frequently edited after being moved to Done.

**Why it happens:** `updated_at` updates on every PATCH, not just column moves.

**How to avoid:** Join `column_history` where `column = 'Done'` to get `entered_at` — the exact moment the ticket arrived in Done. This is the correct "done timestamp."

```sql
-- Correct pattern
SELECT AVG(EXTRACT(epoch FROM (ch.entered_at - t.created_at)))
FROM tickets t
JOIN column_history ch ON ch.ticket_id = t.id AND ch.column = 'Done'
WHERE t.status_column = 'Done';
```

**Warning signs:** Cycle time metrics are unexpectedly large or vary wildly after ticket edits.

### Pitfall 4: Dashboard Endpoint Returns Stale Workload — Includes Backlog

**What goes wrong:** Workload query includes tickets in Backlog or Done, inflating the "active workload" metric.

**Why it happens:** Forgetting the DASH-04 constraint: active = NOT Backlog AND NOT Done.

**How to avoid:** Always filter `status_column NOT IN ('Backlog', 'Done')` in the workload aggregation query. Tickets in Backlog have `owner_id = NULL` by design (TICKET-07), so the owner filter would exclude them anyway — but include the status filter explicitly for correctness.

**Warning signs:** Workload chart shows users with effort on tickets they haven't started.

### Pitfall 5: TicketUpdate Schema Does Not Include New ROI Fields

**What goes wrong:** `PATCH /api/tickets/{id}` silently ignores ROI input fields because `TicketUpdate` schema in `schemas/ticket.py` doesn't list them.

**Why it happens:** Pydantic `exclude_unset=True` means unlisted fields are never applied to the ORM model.

**How to avoid:** Add all 8 ROI input fields to `TicketUpdate` as Optional. Trigger `compute_roi_fields()` in the PATCH handler whenever any ROI input field is in `update_data`.

**Warning signs:** User edits ROI inputs on ticket detail, values appear to save (200 OK), but reloading shows no change.

### Pitfall 6: Live Preview Drifts from Server Persisted Values

**What goes wrong:** The live preview formula runs in the browser using local draft state. If the user edits a field and navigates away without triggering blur, the preview showed a value that was never saved.

**Why it happens:** No explicit save button; save is on blur only.

**How to avoid:** The live preview is intentionally a preview only. The `TicketOut` response after each blur-save returns the server-persisted computed values. Reset local draft state from `ticket.{computed_field}` after each successful mutation (`onSuccess`). This matches the existing pattern in `useTicketDetail.ts`.

---

## Code Examples

### Avg Time Per Column — SQLAlchemy

```python
# Source: PostgreSQL EXTRACT(epoch) pattern + project SQLAlchemy conventions
from sqlalchemy import func, select
from app.models.column_history import ColumnHistory

col_time_stmt = (
    select(
        ColumnHistory.column,
        func.avg(
            func.extract(
                "epoch",
                ColumnHistory.exited_at - ColumnHistory.entered_at
            )
        ).label("avg_seconds"),
    )
    .where(ColumnHistory.exited_at.is_not(None))   # Only completed spans
    .group_by(ColumnHistory.column)
)
rows = (await db.execute(col_time_stmt)).all()
# avg_seconds / 3600.0 = avg_hours per column
```

### Throughput Trend — Last 8 Weeks

```python
# Source: PostgreSQL date_trunc('week') + project conventions
from datetime import datetime, timedelta, timezone

eight_weeks_ago = datetime.now(timezone.utc) - timedelta(weeks=8)

throughput_stmt = (
    select(
        func.date_trunc("week", ColumnHistory.entered_at).label("week_start"),
        func.count(ColumnHistory.ticket_id).label("count"),
    )
    .where(
        ColumnHistory.column == "Done",
        ColumnHistory.entered_at >= eight_weeks_ago,
    )
    .group_by(func.date_trunc("week", ColumnHistory.entered_at))
    .order_by(func.date_trunc("week", ColumnHistory.entered_at))
)
rows = (await db.execute(throughput_stmt)).all()
```

### ROI Null-Safe Division Guard

```python
# Source: project pattern — ROI-05 requirement
# Guard: if dev_cost is 0 or None, roi = NULL (not ZeroDivisionError)
roi = None
if (
    annual_savings is not None
    and dev_cost is not None
    and dev_cost != 0
):
    roi = (annual_savings - dev_cost) / dev_cost
```

### Department Breakdown Query

```python
# Source: project pattern — DASH-05
from sqlalchemy import func, select
from app.models.ticket import Ticket, StatusColumn
from app.models.column_history import ColumnHistory
from sqlalchemy.orm import aliased

done_history = aliased(ColumnHistory)

dept_stmt = (
    select(
        Ticket.department_id,
        func.count(Ticket.id).label("ticket_count"),
        func.avg(
            func.extract("epoch", done_history.entered_at - Ticket.created_at)
        ).label("avg_cycle_seconds"),
    )
    .outerjoin(
        done_history,
        (done_history.ticket_id == Ticket.id)
        & (done_history.column == "Done"),
    )
    .group_by(Ticket.department_id)
)
```

### Pydantic DashboardOut Schema

```python
# Source: project pattern — schemas/dashboard.py
from pydantic import BaseModel
from typing import Optional

class ColumnTimeOut(BaseModel):
    column: str
    avg_hours: float

class WorkloadItemOut(BaseModel):
    user_id: str
    user_name: str
    total_hours: float

class DeptBreakdownItemOut(BaseModel):
    department_id: str
    department_name: str
    ticket_count: int
    avg_cycle_hours: Optional[float] = None

class ThroughputPointOut(BaseModel):
    week: str     # ISO date string — week start Monday
    count: int

class DashboardOut(BaseModel):
    open_ticket_count: int
    overdue_count: int
    throughput_last_week: int
    avg_cycle_time_hours: Optional[float] = None
    column_times: list[ColumnTimeOut]
    workload: list[WorkloadItemOut]
    dept_breakdown: list[DeptBreakdownItemOut]
    throughput_trend: list[ThroughputPointOut]
```

### Sidebar — Enable Dashboard Nav Item

```typescript
// Source: frontend/src/components/sidebar/AppSidebar.tsx
// Change enabled: false → true for Dashboard
const NAV_ITEMS = [
  { label: "Board", href: "/board", enabled: true },
  { label: "Dashboard", href: "/dashboard", enabled: true },  // WAS false
  { label: "Department Portal", href: "/portal", enabled: true },
  { label: "Templates", href: "/settings/templates", enabled: true },
  { label: "Wiki", href: "/wiki", enabled: false },
];
```

### RoiPanel Ghost State (no inputs filled)

```typescript
// Source: CONTEXT.md — "ghost state" when no ROI inputs filled
// Show panel structure with dashes, subtle prompt
function formatCurrency(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPercent(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

const hasAnyRoiInput = !!(
  ticket.current_time_cost_hours_per_week ||
  ticket.employees_affected ||
  ticket.avg_hourly_cost
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts 2.x | Recharts 3.x (3.7.0) | 2024 | Breaking: `CategoricalChartState` removed; use hooks like `useActiveTooltipLabel` instead; `<Customized />` no longer needed for custom components |
| Recharts ResponsiveContainer only | Native `responsive` prop on chart (v3) | Recharts 3.0 | New `responsive` boolean prop available as alternative to wrapping in ResponsiveContainer; still use ResponsiveContainer — it's the established pattern |

**Deprecated/outdated:**
- Phase 3 ROI stub columns (`hours_saved_per_month`, `cost_savings_per_month`, `revenue_impact`): These are placeholders that will be dropped in the Phase 4 Alembic migration and replaced by the full ROI-01 field set.
- Portal form ROI fields: The existing portal form submits stub field names — must be updated as part of Phase 4.

---

## Open Questions

1. **Workload query: what to do when effort_estimate is NULL on active tickets?**
   - What we know: `effort_estimate` is optional; many board-created tickets may not have it set.
   - What's unclear: Should NULL effort tickets be excluded from workload, or counted as 0?
   - Recommendation: Exclude from the sum (SQL `SUM` naturally ignores NULLs). Note in the chart label "Based on tickets with effort estimates set."

2. **Portal form: do the new ROI fields also require at least one non-zero, or does the validation change?**
   - What we know: ROI-06 says "ROI inputs required on portal submissions." The Phase 3 portal enforces at-least-one-non-zero across 3 stub fields.
   - What's unclear: With 8 new fields, does validation stay as at-least-one or does the requirement become specific fields (e.g., hours + employees + cost must all be non-zero to compute weekly_cost)?
   - Recommendation: Require Row 1 fields (hours_saved_per_week, employees_affected, avg_hourly_cost) all to be non-zero for a meaningful ROI; reflect this in the Zod `.refine()` on the portal form.

3. **Dashboard stale time — how often should data refresh?**
   - What we know: Board polls every 30 seconds (BOARD-07). Dashboard is an analytics view.
   - What's unclear: Should dashboard auto-refresh or be manual?
   - Recommendation: Set TanStack Query `staleTime: 5 * 60 * 1000` (5 minutes) and `refetchInterval: false` for the dashboard — executive metrics don't need 30-second freshness. A manual "Refresh" button is optional.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `backend/app/models/ticket.py`, `backend/app/core/config.py`, `backend/app/routers/board.py`, `backend/alembic/versions/93dab7e5b92c_phase3_collab_portal.py`
- `frontend/src/app/(app)/board/_components/TicketDetailModal.tsx` — established inline-edit pattern
- `frontend/package.json` — confirmed recharts NOT installed (must be added)
- `recharts.github.io/en-US/api/` — BarChart props, ResponsiveContainer usage (WebFetch, MEDIUM-HIGH)

### Secondary (MEDIUM confidence)
- Recharts 3.0 migration guide (github.com/recharts/recharts/wiki/3.0-migration-guide) — breaking changes verified
- WebSearch: recharts npm 3.7.0 is current version (multiple sources agree)
- WebSearch + WebFetch: Next.js 14 + recharts "use client" pattern confirmed by multiple authoritative sources
- PostgreSQL `date_trunc('week', ...)` for throughput bucketing — official PostgreSQL docs pattern

### Tertiary (LOW confidence)
- Recharts `responsive` prop (alternative to ResponsiveContainer) — mentioned in Recharts 3.x docs but not verified in depth; stick with ResponsiveContainer which is the established, verified pattern.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — recharts is locked; all other libraries are already installed and in use
- Architecture: HIGH — patterns are continuations of established Phase 2/3 patterns (blur-to-save, selectinload, batch queries)
- Pitfalls: HIGH — stub column replacement is a known migration concern documented in Phase 3 commit messages; Recharts SSR issue is well-documented

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable: Recharts 3.x has been stable; PostgreSQL patterns are stable)
