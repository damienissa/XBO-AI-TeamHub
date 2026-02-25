# Phase 5: Advanced Features - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Power users can manage ticket dependencies, organize work into sprints, define custom fields per workspace (and personally), save filter presets, view a read-only timeline, and read or write wiki pages linked to tickets. All capabilities layer onto the existing kanban app without replacing or breaking the board.

</domain>

<decisions>
## Implementation Decisions

### Sprint board model
- Sprint board is a **separate view** — the existing kanban always shows all tickets unaffected
- "Sprints" is a **top-level sidebar nav item** (same level as Board, Dashboard)
- Tickets are assigned to a sprint via a **Sprint field on the ticket detail modal** (search/select from active sprints)
- Velocity metrics appear as a **header bar at the top of the sprint board**: "X of Y effort hours completed" + % progress

### Dependency visibility
- Dependencies added via **search picker** on ticket detail (type to search by ID or title, select from dropdown)
- Blocked tickets on the kanban board show a **subtle "blocked" badge** only — no color change, no border accent
- When a user tries to move a blocked ticket and the server rejects it: **toast notification** listing the blocking tickets (e.g. "Blocked by PROJ-12, PROJ-34 — resolve first")
- Dependencies displayed in a **dedicated "Dependencies" section** on ticket detail, above subtasks; shows both "blocks" and "blocked by" separately

### Wiki placement & navigation
- Wiki is a **top-level sidebar nav item** (same level as Board, Dashboard, Sprints)
- Wiki listing page uses a **hierarchical tree** (pages can have parent-child relationships, displayed as a tree in sidebar)
- Tickets link to wiki pages via a **"Wiki" field on ticket detail** (search picker to select a page)
- Rich text editor (Tiptap) supports **basic formatting**: bold, italic, H1–H3, bullet lists, numbered lists, code blocks

### Custom fields layout
- Custom fields appear in a **dedicated "Custom Fields" section** at the bottom of the ticket detail (below system fields, above or after subtasks)
- Supported field types: **Text, Number, Date**
- **Two scopes of custom fields:**
  - **Workspace fields**: Admin-defined in Workspace Settings, shared across all users, appear on every ticket
  - **Personal fields**: User-defined, private — only the creating user sees them; created inline on ticket detail via an "Add my field" button in the Custom Fields section
- Admin manages workspace field definitions in **Workspace Settings** ("Custom Fields" tab)

### Saved filters
- Saved filters accessible via a **"Saved" dropdown in the board's existing filter bar** — users can save current filter state with a name and reload presets from the same dropdown

### Claude's Discretion
- Timeline view: how tickets without due dates are shown (hide, show at end, or show as undated)
- Exact tree rendering approach for wiki hierarchy (left sidebar vs. outline on page)
- Sprint board column layout (mirror kanban columns vs. custom sprint columns)
- Personal field definitions storage schema (JSONB on user, separate table, etc.)
- Empty states for each new view (no sprints yet, no wiki pages yet, etc.)

</decisions>

<specifics>
## Specific Ideas

- Wiki hierarchy should feel similar to Notion's page tree — pages nested under parents in the sidebar
- Sprint velocity bar should be immediately scannable at the top — no need to scroll or expand anything
- Blocked badge on kanban cards should be subtle enough not to dominate the board visually
- Personal custom fields: created inline on ticket detail so users don't need to navigate to settings

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-advanced-features*
*Context gathered: 2026-02-25*
