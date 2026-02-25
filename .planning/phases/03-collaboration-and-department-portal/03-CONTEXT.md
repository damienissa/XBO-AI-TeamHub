# Phase 3: Collaboration and Department Portal - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

AI team members can collaborate on tickets via comments and subtasks, and log intake tickets on behalf of any department using a structured portal form with ROI inputs. Also includes ticket templates. Attachment metadata stub (no file bytes). PRD auto-fill and file upload are out of scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Comment UX
- Comments are a separate section below the activity timeline — not merged into it
- Comments are not editable after posting (post is final)
- Deletion requires a confirm dialog (author or admin can delete)
- Always-visible text input + submit button at the bottom of the comments section

### Subtask UI
- Dedicated "Subtasks" section in the ticket detail modal, between description and comments
- Add subtask via inline text input at the bottom of the list — type and press Enter
- Kanban card shows a text pill badge: checkmark icon + "2/5" (hidden when no subtasks)
- When all subtasks are checked off: badge turns green, no other action (no auto-move prompt)
- Drag-to-reorder within the subtask list

### Department Portal
- Accessed via a "Portal" sidebar nav item → lands on a department selection page
- Selecting a department opens a full-page intake form with all ticket fields + ROI inputs
- Admin and Member roles can access the portal; viewer/read-only cannot
- After submission: success confirmation on the portal page with a "View on board" link (not auto-redirect to board)

### ROI Inputs
- Three fields on the portal intake form: time saved (hours/month), cost savings ($/month), revenue impact ($)
- ROI dollar estimate is auto-calculated: hours_saved × fixed hourly rate (configurable, e.g. $75/hr)
- The computed ROI figure is shown live as the user types hours saved
- At least one ROI field must be non-zero before submission (enforced by form validation)

### Ticket Templates
- Templates managed on a dedicated "Templates" settings page — created from scratch, not from existing tickets
- Admin and Member roles can create/edit/delete templates
- "Create from template" flow: selecting a template opens the ticket creation form pre-filled and editable; user reviews and submits manually (no instant auto-creation)

### Claude's Discretion
- Exact layout and spacing of the portal intake form
- Subtask drag handle visual (dots, bars, etc.)
- Comment author avatar display
- Template list UI on the settings page

</decisions>

<specifics>
## Specific Ideas

- The portal should feel like a structured intake form, not a quick add — full-page, deliberate
- ROI computation should be live/reactive as the user types hours saved (shows calculated value in real time)
- PRD upload that auto-fills form fields is desired but deferred to Phase 6 (AI Features)

</specifics>

<deferred>
## Deferred Ideas

- PRD/document upload that automatically fills in ticket fields using AI — Phase 6 (AI Features)

</deferred>

---

*Phase: 03-collaboration-and-department-portal*
*Context gathered: 2026-02-25*
