---
phase: 01-admin-user-management
plan: 01
subsystem: admin
tags: [express, prisma, multer, react-context, tailwind, settings, branding, file-upload]

# Dependency graph
requires:
  - phase: none
    provides: first phase, no prior dependencies
provides:
  - Settings CRUD API (GET all, GET by key, PUT branding, POST/DELETE logo, PUT pass-through, PUT alerts)
  - SettingsService with merge-safe upsert and logo file management
  - SettingsContext global provider for branding, alerts, pass-through
  - Admin Settings page with four card sections
  - Dynamic sidebar branding via useSettings()
  - N+1 permission middleware fix (cached permissions from req.user)
affects: [phase-03-export-xero, phase-01-plan-02-user-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Settings as key-value JSON store (Setting model with merge-safe upsert)"
    - "File upload via Multer memoryStorage + express.static serving"
    - "React context for global app settings (SettingsProvider wraps app)"
    - "Inline style for dynamic branding colours (replaces hard-coded Tailwind classes)"

key-files:
  created:
    - server/src/services/SettingsService.ts
    - server/src/routes/settings.ts
    - client/src/lib/settingsApi.ts
    - client/src/lib/SettingsContext.tsx
    - client/src/components/admin/AdminSettings.tsx
    - client/src/components/admin/BrandingSection.tsx
    - client/src/components/admin/PassThroughSection.tsx
    - client/src/components/admin/AlertThresholds.tsx
    - client/src/components/admin/SystemStatus.tsx
  modified:
    - server/src/index.ts
    - server/src/middleware/permissions.ts
    - server/src/services/AuthService.ts
    - client/src/App.tsx
    - client/src/components/layout/Sidebar.tsx
    - .gitignore

key-decisions:
  - "Tag-list pattern for pass-through items (compact for short lists vs editable table)"
  - "Live preview in branding section shows mini sidebar/header mockup"
  - "server/uploads/ directory for logo files, served via express.static at /api/uploads/"
  - "SettingsProvider wraps outermost (above WeekProvider) since it has no dependencies"
  - "Inline style for active nav items replaces Tailwind classes for dynamic primaryColour"

patterns-established:
  - "Settings merge-safe upsert: read existing, spread with new, prevents race conditions"
  - "Admin section pattern: card with id anchor, local form state, explicit Save button, refreshSettings on success"
  - "useSettings() hook for global branding consumption across components"

# Metrics
duration: 15min
completed: 2026-02-06
---

# Phase 1 Plan 1: Admin Settings Summary

**Settings backend API with branding/logo/pass-through/alerts endpoints, SettingsContext provider for global branding, four-section Admin Settings page, and N+1 permission middleware fix**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-06T02:22:44Z
- **Completed:** 2026-02-06T02:37:09Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Settings CRUD API with 6 endpoints: GET all, GET by key, PUT branding, POST/DELETE logo, PUT pass-through categories, PUT alert thresholds
- SettingsService with merge-safe upsert (prevents race condition between logo path and text fields) and logo file management (upload, delete, unique filenames)
- Admin Settings page with four card sections: Branding (logo drag-drop, company name, colour pickers with presets and live preview), Pass-Through Items (tag-list with add/remove), Alert Thresholds (3 metrics with warning/critical sliders and colour zone bars), System Status (greyed-out Xero/3CX/Reportei placeholders plus backup status card)
- SettingsContext global provider: loads all settings on mount, exposes refreshSettings() for immediate UI updates after save
- Sidebar dynamically renders logo or company name from branding settings, active nav item colour driven by primaryColour via inline styles
- N+1 permission middleware fix: resolvePermission now accepts optional cached permissions array from req.user, eliminating per-route DB queries; getDevUser updated to include permissions

## Task Commits

Each task was committed atomically:

1. **Task 1: Settings backend API, logo upload, and permission middleware fix** - `fb09b09` (feat)
2. **Task 2: Admin Settings frontend, SettingsContext, all sections, branding integration** - `cd7d345` (feat)

## Files Created/Modified

- `server/src/services/SettingsService.ts` - Static service class with getAll, get, upsert (merge-safe), uploadLogo, deleteLogo
- `server/src/routes/settings.ts` - 6 settings endpoints with Zod validation and Multer for logo upload
- `server/src/index.ts` - Route registration for settings, express.static for /api/uploads/
- `server/src/middleware/permissions.ts` - resolvePermission accepts cached permissions, requirePermission passes them
- `server/src/services/AuthService.ts` - getDevUser includes permissions via follow-up findUnique
- `client/src/lib/settingsApi.ts` - Typed API client with BrandingSettings and AlertThreshold interfaces
- `client/src/lib/SettingsContext.tsx` - Global settings provider with branding, alerts, pass-through state
- `client/src/components/admin/AdminSettings.tsx` - Main admin page container with four sections
- `client/src/components/admin/BrandingSection.tsx` - Logo upload, company name, colour pickers, live preview
- `client/src/components/admin/PassThroughSection.tsx` - Tag-list for pass-through items
- `client/src/components/admin/AlertThresholds.tsx` - 3 metric cards with warning/critical sliders and colour zones
- `client/src/components/admin/SystemStatus.tsx` - Placeholder integration cards and backup status
- `client/src/App.tsx` - SettingsProvider wrapper, AdminSettings replaces placeholder
- `client/src/components/layout/Sidebar.tsx` - Dynamic branding via useSettings()
- `.gitignore` - Added server/uploads/

## Decisions Made

- **Tag-list for pass-through items:** Chosen over editable table as it is more compact and intuitive for a short list of 2-5 items (aligned with Claude's Discretion in CONTEXT.md)
- **Live preview in branding section:** Shows a mini sidebar/header mockup that updates in real-time as the user adjusts colours and company name, giving immediate visual feedback before saving
- **Inline styles for dynamic branding colours:** Replaced hard-coded Tailwind `bg-[#4573D2]/10 text-[#4573D2]` classes on the active sidebar nav item with `style={{ backgroundColor: branding.primaryColour + '1A', color: branding.primaryColour }}` to support dynamic colour changes from admin settings
- **express.static placement:** Placed before auth middleware so logo images load without authentication (required for login page branding in future phases)
- **Merge-safe upsert pattern:** SettingsService reads existing value before upsert and spreads to prevent logoPath being overwritten when only updating text fields (addresses race condition pitfall from research)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added server/uploads/ to .gitignore**
- **Found during:** Task 1 (Settings backend)
- **Issue:** Uploaded logo files should not be committed to the repository
- **Fix:** Added `server/uploads/` to .gitignore
- **Files modified:** .gitignore
- **Verification:** `git status` does not show uploads directory contents
- **Committed in:** fb09b09 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Minor addition necessary for repository hygiene. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Settings API and SettingsContext are complete, ready for Plan 02 (User Management) to build upon the same patterns
- Permission middleware N+1 fix is in place, benefiting all existing and future routes
- Admin Settings page is fully functional with all four sections
- Phase 3 (Export & Xero) can now consume branding settings from SettingsContext for PDF export headers and logo

---
*Phase: 01-admin-user-management*
*Completed: 2026-02-06*
