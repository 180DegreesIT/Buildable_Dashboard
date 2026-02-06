---
phase: 03-export-xero-integration
plan: 03
subsystem: api
tags: [xero, oauth2, encryption, aes-256-gcm, node-cron, rate-limiting, prisma]

# Dependency graph
requires:
  - phase: 01-admin-user-management
    provides: Admin settings UI, auth middleware, permissions
provides:
  - Xero OAuth2 authorisation flow (mock + real mode scaffold)
  - Encrypted token storage with AES-256-GCM
  - P&L, invoice, and bank summary sync services
  - Rate limiter (60/min, 5000/day with exponential backoff)
  - Scheduled daily sync via node-cron
  - Interactive Xero card in admin settings UI
  - XeroToken and XeroSyncLog database models
affects: [04-validation]

# Tech tracking
tech-stack:
  added: [xero-node, node-cron]
  patterns: [singleton service pattern, AES-256-GCM token encryption, rate limiting with sliding window, mock mode for external integrations]

key-files:
  created:
    - server/src/services/XeroAuthService.ts
    - server/src/services/XeroSyncService.ts
    - server/src/services/XeroScheduler.ts
    - server/src/routes/xero.ts
    - client/src/lib/xeroApi.ts
    - server/.env.example
    - server/prisma/migrations/20260206071834_add_xero_models/migration.sql
  modified:
    - server/prisma/schema.prisma
    - server/src/index.ts
    - client/src/components/admin/SystemStatus.tsx
    - server/package.json

key-decisions:
  - "Mock mode defaults to true when XERO_MOCK_MODE env var is not set (safe for development)"
  - "Token encryption uses AES-256-GCM with random IV per encryption, stored as iv:authTag:ciphertext hex format"
  - "Rate limiter uses 55/min headroom (from 60 limit) and 4800/day safety margin (from 5000 limit)"
  - "OAuth2 callback uses direct Xero API fetch (not xero-node SDK) for token exchange to avoid SDK version coupling"
  - "Refresh token mutex prevents concurrent refresh attempts"
  - "XeroSyncService generates realistic mock data matching existing schema value ranges"
  - "Created separate xeroApi.ts client library instead of adding to settingsApi.ts (separation of concerns)"

patterns-established:
  - "Mock mode pattern: service.isMockMode() check before external API calls, generate realistic test data"
  - "Singleton service with getInstance(): used for XeroAuthService and XeroSyncService"
  - "Rate limiter: sliding window array + exponential backoff on 429"
  - "Sync log pattern: create processing record, update on success/failure with completedAt timestamp"

# Metrics
duration: 16min
completed: 2026-02-06
---

# Phase 03 Plan 03: Xero Integration Summary

**Xero OAuth2 scaffold with AES-256-GCM encrypted token storage, P&L/invoice/bank sync services, node-cron scheduling, rate limiting, and interactive admin UI -- all operational in mock mode**

## Performance

- **Duration:** 16 min
- **Started:** 2026-02-06T07:17:07Z
- **Completed:** 2026-02-06T07:33:03Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Complete Xero OAuth2 authorisation flow working end-to-end in mock mode (connect, consent simulation, callback, encrypted token storage)
- Three sync services (P&L, invoices, bank summary) generating realistic mock data and upserting into correct database tables
- Rate limiter with sliding 60-second window (55/min headroom) and daily 4800-call safety margin with exponential backoff
- Interactive Xero card in admin settings: connect/disconnect, Sync Now, auto-sync scheduler toggle
- Encrypted token storage using AES-256-GCM (random IV per encryption, not plaintext in DB)

## Task Commits

Each task was committed atomically:

1. **Task 1: Database models, Xero auth service, and sync services** - `196a7e5` (feat)
2. **Task 2: API routes and admin UI wiring** - `8776b0e` (feat)

## Files Created/Modified
- `server/prisma/schema.prisma` - Added XeroToken and XeroSyncLog models
- `server/prisma/migrations/20260206071834_add_xero_models/` - Migration for new tables
- `server/src/services/XeroAuthService.ts` - OAuth2 flow, token encrypt/decrypt/refresh, mock mode, connection status
- `server/src/services/XeroSyncService.ts` - P&L, invoice, bank summary sync with mock data generators and rate limiter
- `server/src/services/XeroScheduler.ts` - node-cron daily sync scheduling with start/stop/isRunning
- `server/src/routes/xero.ts` - Express routes for connect, callback, status, disconnect, sync, sync-logs, scheduler
- `server/src/index.ts` - Registered /api/v1/xero routes
- `client/src/components/admin/SystemStatus.tsx` - Interactive Xero card with connect/disconnect/sync/scheduler UI
- `client/src/lib/xeroApi.ts` - Typed API client for all Xero endpoints
- `server/.env.example` - Documents all required environment variables
- `server/package.json` - Added xero-node and node-cron dependencies

## Decisions Made
- **Mock mode defaults to true:** When `XERO_MOCK_MODE` env var is not set, system defaults to mock mode -- safe for development without live Xero credentials
- **Direct Xero API fetch instead of SDK:** Used native `fetch` for token exchange and refresh to avoid tight coupling to xero-node SDK version; SDK can be used for live report/invoice calls later
- **Separate xeroApi.ts:** Created dedicated client library rather than appending to settingsApi.ts -- keeps concerns separated
- **Refresh token mutex:** Module-level promise variable prevents concurrent refresh attempts
- **Realistic mock data ranges:** P&L mock values ($200K-300K income, 28-34% COGS, 55-65% wages) match Buildable's actual financial structure

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **Prisma generate DLL lock:** Windows file lock on `query_engine-windows.dll.node` during `prisma generate` after migration. Resolved by deleting the locked DLL file and re-running `prisma generate`. This is a pre-existing Windows-specific Prisma issue, not related to our changes.

## User Setup Required

External Xero credentials are pending from 180D. When received:
1. Set `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET` in `server/.env`
2. Generate encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. Set `XERO_ENCRYPTION_KEY` in `server/.env`
4. Set `XERO_MOCK_MODE=false` to enable live Xero connection
5. Verify with: Connect button in Admin Settings Xero card

## Next Phase Readiness
- Xero integration scaffold complete and testable in mock mode
- When live credentials arrive, toggle `XERO_MOCK_MODE=false` to activate real Xero API calls
- Phase 3 plans 01 (PDF export) and 02 (3CX/Reportei) can proceed independently
- Phase 4 (validation) can verify Xero sync data integrity

---
*Phase: 03-export-xero-integration*
*Completed: 2026-02-06*
