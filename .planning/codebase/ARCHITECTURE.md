# Architecture

**Analysis Date:** 2026-02-06

## Pattern Overview

**Overall:** Layered monorepo with domain-driven routing on backend, component-based UI on frontend.

**Key Characteristics:**
- Monorepo structure: `client/` (React) and `server/` (Node.js Express) as separate npm workspaces
- Backend organized by domain routes (financial, projects, sales, teams, marketing, targets, uploads, weeks, dashboard)
- Service layer for business logic separate from routes (WeekService, TargetService, FinancialService, ImportService, CsvParserService)
- Frontend: React Context for cross-component state (WeekProvider), page-based component structure
- Authentication: middleware-based with dev bypass (NODE_ENV=development)
- Database: Prisma ORM with PostgreSQL, managed via generated client

## Layers

**Presentation (Frontend):**
- Purpose: React UI for dashboard visualization, data entry, target management
- Location: `client/src`
- Contains: Page components, shared UI components, layout shells, chart components
- Depends on: Client API wrapper (`lib/api.ts`, `lib/dashboardApi.ts`, `lib/targetApi.ts`), Context providers
- Used by: Browser/user interaction

**API Gateway (Backend):**
- Purpose: Express server routing requests by domain, handling auth/permissions before service layer
- Location: `server/src/index.ts`
- Contains: Route definitions in `server/src/routes/`
- Depends on: Authentication middleware, permission middleware, service layer
- Used by: Frontend via /api/v1 endpoint, health checks at /api/health

**Authentication & Authorization:**
- Purpose: Verify user identity and enforce page-level permissions
- Location: `server/src/middleware/auth.ts`, `server/src/middleware/permissions.ts`
- Contains: JWT verification (production), dev bypass, role-based defaults, explicit permission lookup
- Depends on: Prisma for user/permission queries
- Used by: All /api/v1 routes (auth middleware), specific routes (permission middleware via `requirePermission()`)

**Business Logic (Services):**
- Purpose: Domain-specific calculations and transformations
- Location: `server/src/services/`
- Contains:
  - `WeekService`: Saturday date snapping, week validation, nearest-Saturday logic
  - `TargetService`: Active target resolution, effective date range logic, target history
  - `FinancialService`: Derived metric computation (gross profit margin, profit %, revenue-to-staff ratio)
  - `CsvParserService`: CSV parsing, delimiter detection, column type inference, row validation
  - `ImportService`: Duplicate detection, row-by-row import with rollback capability
  - `DataTypeRegistry`: 15+ importable data types, field definitions, target table mapping
  - `AuthService`: User session management, dev user resolution
- Depends on: Prisma database client
- Used by: Route handlers

**Data Access (Persistence):**
- Purpose: Database interaction via Prisma ORM
- Location: `server/src/db.ts` (singleton), `server/prisma/schema.prisma`
- Contains: Generated Prisma client, 18 table groups with relationships
- Depends on: PostgreSQL driver, .env connection string
- Used by: All services and routes

## Data Flow

**Executive Summary Request:**
1. Client browser (ExecutiveSummary.tsx) calls `fetchExecutiveSummary(weekEnding)` via lib/dashboardApi.ts
2. GET /api/v1/dashboard/executive-summary?weekEnding=YYYY-MM-DD hits backend
3. Auth middleware verifies JWT (or auto-authenticates in dev)
4. Route handler (dashboard.ts) calls FinancialService, TargetService, and database queries in parallel
5. Route compiles 13-week trend data, KPI values, breakdown by region
6. JSON response returned to frontend
7. ExecutiveSummary.tsx renders KPI cards, charts, and regional breakdown

**CSV Upload Flow:**
1. Client opens UploadWizard (5-step modal)
   - Step 1: User selects data type from DataTypeRegistry
   - Step 2: User uploads .csv/.tsv file
   - Step 3: System auto-maps columns if ≥80% match previous mapping, or user manually maps
   - Step 4: Preview rows with validation results (errors/warnings/passed)
   - Step 5: User confirms and imports
2. Backend receives file at POST /api/v1/uploads/parse
   - CsvParserService.parseCsv() parses file, detects delimiter, infers column types
3. Backend POST /api/v1/uploads/apply-mapping
   - Applies field mappings, validates rows (dates snap to Saturday, currency normalization)
   - Detects duplicates (checks existing records by unique key)
   - Returns preview with row-level validation status
4. Backend POST /api/v1/uploads/confirm
   - ImportService.importRows() processes confirmed rows
   - Duplicate strategy applied (skip/overwrite/merge)
   - Row-by-row insert/update with error collection
   - Returns upload summary (IDs, row counts, error list)

**State Management:**
- WeekProvider (Context) maintains `selectedWeek` (Saturday ISO date string), available weeks list, loading state
- Fetched via /api/v1/weeks/current and /api/v1/weeks/list on app mount
- Components subscribe via `useWeek()` hook and refetch data when week changes
- UploadWizard maintains local component state for multi-step form progression

## Key Abstractions

**Week as Saturday-based Entity:**
- Purpose: All financial data keyed by week_ending (always a Saturday)
- Examples: `server/src/services/WeekService.ts`, `client/src/lib/WeekContext.tsx`
- Pattern: Snap dates to nearest Saturday (within 3 days); enforce ISO date format YYYY-MM-DD for API

**Target with Effective Date Range:**
- Purpose: Support multiple target versions with temporal validity
- Examples: `server/src/services/TargetService.ts`, target resolution by effective_from/effective_to
- Pattern: Query targets ordered by effective_from DESC, take first match for given week_ending

**CSV Import as Multi-Step Validation Pipeline:**
- Purpose: Convert unstructured CSV to structured database inserts
- Examples: `server/src/services/CsvParserService.ts`, `server/src/services/ImportService.ts`, DataTypeRegistry
- Pattern: Parse → Validate → Preview → Confirm → Import, with error collection at each step

**Data Type Definition (Registry):**
- Purpose: Declaratively define mappable CSV types (15+ types) without code changes
- Examples: `server/src/services/DataTypeRegistry.ts`
- Pattern: Each type specifies target table, required/optional fields, field types, validation rules

**Derived Financial Metrics:**
- Purpose: Compute secondary metrics from raw financial data
- Examples: `server/src/services/FinancialService.computeDerivedMetrics()`
- Pattern: Accept raw financial record, return computed metrics (gross profit %, profit %, revenue-to-staff ratio)

**Permission Resolution (Explicit + Role Defaults):**
- Purpose: Flexible page-level access control without per-page hardcoding
- Examples: `server/src/middleware/permissions.ts`, resolvePermission function
- Pattern: Check explicit permission entry first; fall back to role default; special handling for staff/admin pages

## Entry Points

**Backend Server:**
- Location: `server/src/index.ts`
- Triggers: `npm run dev` (dev mode) or `npm run start` (production)
- Responsibilities: Initialize Express app, mount CORS, attach auth middleware, register all domain routes, error handler

**Frontend App:**
- Location: `client/src/main.tsx` (React entry) → `client/src/App.tsx` (App component)
- Triggers: Vite dev server at localhost:6000 or built bundle in production
- Responsibilities: Render App shell (Sidebar, TopBar, main content area), initialize WeekProvider, conditional page rendering based on activePage state

**Route Entry Points (Backend):**
- `server/src/routes/dashboard.ts`: `/api/v1/dashboard/executive-summary`, `/api/v1/dashboard/financial-deep-dive`, `/api/v1/dashboard/regional-performance`
- `server/src/routes/uploads.ts`: `/api/v1/uploads/parse`, `/api/v1/uploads/data-types`, `/api/v1/uploads/apply-mapping`, `/api/v1/uploads/confirm`, `/api/v1/uploads/history`
- `server/src/routes/targets.ts`: `/api/v1/targets/current`, `/api/v1/targets/` (POST/PUT)
- `server/src/routes/weeks.ts`: `/api/v1/weeks/current`, `/api/v1/weeks/list`
- `server/src/routes/financial.ts`, `sales.ts`, `projects.ts`, `teams.ts`, `marketing.ts`: Domain-specific endpoints

## Error Handling

**Strategy:** Middleware-based error catching with ApiError class for structured responses.

**Patterns:**
- Custom `ApiError` class with statusCode (400, 404, 500) for predictable error format
- Route handlers wrap async logic in try-catch, pass errors to `next(err)`
- Centralized `errorHandler` middleware logs error and returns `{ error: { message, statusCode } }` JSON
- Frontend fetch wrapper checks `res.ok` and throws error with fallback message
- CSV validation collects row-level errors without failing entire import; user sees summary with fixable rows

## Cross-Cutting Concerns

**Logging:**
- Backend: `console.error()` in error handler (logs message + stack trace)
- Frontend: Browser console via fetch errors and component warnings
- No centralized logging service (future enhancement)

**Validation:**
- Backend: Zod schemas in middleware (`validateQuery`, `validateBody`) for request validation
- Backend: Row-level validation in CsvParserService (type coercion, date snapping, required field checking)
- Frontend: Form state management and pre-submission checks in UploadWizard steps

**Authentication:**
- Dev mode (NODE_ENV=development): Auto-authenticate as configured dev user, skip token check
- Production: JWT in Authorization: Bearer header, validated via AuthService.verifyToken()
- All /api/v1 routes protected except /auth (login/callback)

---

*Architecture analysis: 2026-02-06*
