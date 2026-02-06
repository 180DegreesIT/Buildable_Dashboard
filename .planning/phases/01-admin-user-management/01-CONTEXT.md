# Phase 1: Admin & User Management - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Administrators can configure system branding, business rules (pass-through items), alert thresholds, and system integration status through a dedicated settings page. Separately, admins can manage users: view all users, assign roles, and control page-level permissions through a matrix grid. This phase covers admin settings and user management UI + backend. It does NOT include the actual integrations (Xero, 3CX, Reportei) — only placeholder status cards.

</domain>

<decisions>
## Implementation Decisions

### Branding & Appearance
- Drag-and-drop zone for logo upload with click fallback, preview before confirming, crop/resize option
- Accent colour picker: preset swatches plus a custom hex input field
- Branding appears everywhere: sidebar, header, login page, PDF exports (Phase 3 will consume these settings), loading screen — full white-label feel
- Live preview of changes (e.g., header updates as colour is picked) with explicit Save button to persist — no auto-save

### Settings Layout
- Single scrollable page with all settings sections stacked vertically in cards
- Section anchors in URL (e.g., `/settings#alerts`) so sections are deep-linkable
- Sections: Branding, Pass-Through Items, Alert Thresholds, System Status
- Each section is a distinct card with clear heading

### Pass-Through Items
- Claude's Discretion: choose between inline tag-list (text input + Add button, items with X to remove) or editable table — whichever is cleaner for a short list

### Alert Thresholds
- Range sliders with companion number inputs — shows colour zones (green/amber/red)
- Extensible list: start with core three metrics (Net Profit, Team Revenue Performance, Cash Position) but design the UI so new metrics can be added easily later
- Two severity levels per metric: Warning (amber) and Critical (red) thresholds
- Both directions supported: "alert when below $X" and "alert when above X%" — covers both profit (too low) and Revenue to Staff Ratio (too high)
- When threshold is breached: KPI card changes colour on dashboard AND a dismissible alert banner appears at top of the relevant page
- Global thresholds only — one set for the whole organisation, admin configures
- No separate alert history log — weekly data already exists in the database, past breaches can be derived on demand from stored data + threshold config
- Claude's Discretion: snooze/dismiss behaviour for alert banners

### System Status Cards
- Greyed-out placeholder cards for Xero, 3CX, and Reportei
- Each shows service name, "Not Connected" badge, and a disabled "Configure" button
- Minimal — just enough to show where integrations will live

### Permission Matrix UX
- User list displayed as a standard data table: avatar, name, email, role dropdown, last login — sortable columns
- Inline dropdowns in the permission grid — each cell is a dropdown (Read / Write / No Access)
- When admin changes a user's role: confirmation dialog "Apply default permissions for [Role]?" then auto-fills the grid. Admin can still tweak individual permissions after
- Bulk actions: checkboxes on user rows, select multiple, then "Set Role" or "Apply Permissions" action
- Save button to persist permission changes (consistent with branding save pattern)

### Claude's Discretion
- Pass-through items UI pattern (tag-list vs table)
- Alert banner snooze/dismiss behaviour
- Exact table pagination and sorting defaults for user list
- Loading states and error handling throughout settings
- Spacing and card styling details within the Asana design language

</decisions>

<specifics>
## Specific Ideas

- Settings page should feel like a single "control panel" — scroll down through cards, not navigate between tabs
- Alert colour zones on the slider should give immediate visual feedback about severity
- Permission matrix should be scannable at a glance — directors want to quickly see who has access to what
- The whole-app branding (login page, loading screen, exports) makes it feel like Buildable's own tool, not a generic dashboard

</specifics>

<deferred>
## Deferred Ideas

- Actual Xero/3CX/Reportei integration implementation — Phase 3
- Email notifications when thresholds are breached — not in scope, could be future enhancement
- Per-role or per-user threshold overrides — global only for now

</deferred>

---

*Phase: 01-admin-user-management*
*Context gathered: 2026-02-06*
