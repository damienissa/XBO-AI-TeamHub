# Phase 4: ROI Estimation and Executive Dashboard - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Two deliverables: (1) a computed ROI panel on every ticket detail, editable inline, with live-preview calculation; (2) an executive analytics dashboard accessible to all authenticated users showing KPIs, throughput trend, workload per team member, column time breakdown, and department breakdown. Ticket creation flow, advanced filters, and sprint-level reporting are separate phases.

</domain>

<decisions>
## Implementation Decisions

### ROI panel location and layout
- Always-visible section on the ticket detail (not accordion, not tabs) — same presence as comments and subtasks
- ROI % is the headline number, annual savings is secondary
- Supporting numbers (weekly cost, yearly cost, dev cost, adjusted ROI) shown in a smaller grid below the hero stats
- When no ROI inputs are filled: show the panel structure with dashes for values and a subtle "Add ROI inputs to compute" prompt — never hide the panel entirely

### ROI panel editability
- ROI inputs are editable inline on the ticket detail (same as urgency or due date)
- Live preview: computed values (ROI %, annual savings, etc.) update in real time as the user types
- Save triggers on field blur (no explicit save button needed for individual fields)
- Portal submissions still require ROI inputs at submission time

### ROI inputs layout on ticket detail
- ROI inputs NOT on QuickAdd form — only editable on the ticket detail after creation
- Two logical rows: Row 1 — core cost inputs (hours saved/week, employees affected, avg hourly cost); Row 2 — adjustment factors (expected savings rate, risk probability, strategic value 1–5)
- Optional fields (error rate, revenue blocked) in a secondary collapsible within the ROI section

### Dashboard access and navigation
- Accessible to all authenticated users (admin + member) — no role restriction
- Top-level sidebar nav item: "Dashboard" — same level as Board and Portal
- Layout: 4 KPI cards in a row at the top, then two-column row (workload bar chart left, dept breakdown table right), then column time breakdown row at the bottom

### Dashboard KPI definitions
- **Overdue count**: tickets where `due_date < today` AND column is NOT Done
- **Throughput**: tickets moved to Done per week
- **Avg cycle time**: created_at → done timestamp across completed tickets
- **Open ticket count**: all tickets not in Done

### Throughput trend chart
- Last 8 weeks of data (2 months)
- Recharts LineChart or AreaChart (Claude's discretion on chart type)

### Workload chart
- Shows sum of `effort_estimate` on tickets where user is owner AND column is NOT Backlog AND column is NOT Done (active tickets only)
- Recharts BarChart, one bar per team member

### Bottleneck highlight
- Each column has a card showing avg time tickets spent there
- The column with the highest avg time gets a red/orange accent (border or background) — no badge label

</decisions>

<specifics>
## Specific Ideas

- ROI panel should feel like a financial summary card — numbers are the content, not prose
- The "Add ROI inputs to compute" prompt should be subtle/muted, not a call-to-action button — more of a ghost state
- Dashboard layout mirrors common analytics tools: KPIs at a glance up top, detail below

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-roi-estimation-and-executive-dashboard*
*Context gathered: 2026-02-25*
