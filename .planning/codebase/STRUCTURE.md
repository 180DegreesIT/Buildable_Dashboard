# Codebase Structure

**Analysis Date:** 2026-02-06

## Directory Layout

```
buildable-dashboard/
├── client/                    # React + TypeScript frontend (Vite)
│   ├── src/
│   │   ├── components/        # React components (layout, dashboard, upload, UI, admin, targets)
│   │   ├── lib/              # Utilities: API wrappers, Context providers
│   │   ├── assets/           # Static images, fonts, icons
│   │   ├── App.tsx           # Root App component
│   │   ├── main.tsx          # React entry point
│   │   └── index.css         # Tailwind styles
│   ├── vite.config.ts        # Vite configuration
│   ├── tsconfig.json         # TypeScript config
│   ├── package.json          # Client dependencies
│   └── index.html            # HTML template
│
├── server/                    # Node.js + Express backend
│   ├── src/
│   │   ├── routes/           # Domain-grouped API endpoints
│   │   ├── services/         # Business logic (WeekService, TargetService, etc.)
│   │   ├── middleware/       # Auth, permissions, validation, error handling
│   │   ├── generated/        # Prisma-generated client & types
│   │   ├── db.ts             # Prisma client singleton
│   │   ├── index.ts          # Express app entry point
│   │   └── seed.ts           # Database seeding script
│   ├── prisma/
│   │   └── schema.prisma     # Database schema with 18 table groups
│   ├── package.json          # Server dependencies
│   └── tsconfig.json         # TypeScript config
│
├── .planning/
│   └── codebase/             # Analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
├── package.json              # Monorepo root with workspaces
├── CLAUDE.md                 # Project instructions & guidelines
├── start-dashboard.bat       # Windows start script
├── stop-dashboard.bat        # Windows stop script
└── .env.example              # Template for environment variables
```

## Directory Purposes

**`client/src/components/`:**
- Purpose: React component hierarchy organized by feature/layout
- Contains: Layout shell (Sidebar, TopBar), page components (ExecutiveSummary, FinancialDeepDive, RegionalPerformance), CSV upload wizard, targets management, shared UI kit
- Key files:
  - `layout/`: App shell components (Sidebar.tsx, TopBar.tsx, PlaceholderPage.tsx)
  - `dashboard/`: Page-level dashboard components with charts (ExecutiveSummary.tsx, FinancialDeepDive.tsx, NetProfitChart.tsx, etc.)
  - `upload/`: 5-step CSV upload wizard (UploadWizard.tsx, FileUploader.tsx, ColumnMapper.tsx, PreviewValidate.tsx, ConfirmImport.tsx)
  - `targets/`: Target management UI (TargetManagement.tsx, TargetEditModal.tsx, TargetHistory.tsx, BulkTeamUpdate.tsx)
  - `ui/`: Reusable UI primitives (KPICard.tsx, DataTable.tsx, LoadingSkeleton.tsx, EmptyState.tsx, ExportButtons.tsx, NetRevenueToggle.tsx)
  - `alerts/`: Alert/notification components (if any)
  - `charts/`: Recharts-based visualizations (CostAnalysisChart.tsx, RegionalTrendChart.tsx, RevenueBreakdownChart.tsx, etc.)
  - `admin/`: Admin pages (User Management, Admin Settings placeholders)

**`client/src/lib/`:**
- Purpose: Shared utilities, API wrappers, context providers
- Contains:
  - `api.ts`: Base API client for uploads (parse, data-types, apply-mapping, confirm, history)
  - `dashboardApi.ts`: Dashboard-specific queries (executive summary, financial deep dive, regional performance)
  - `targetApi.ts`: Target management API calls (get current, create, update, history)
  - `WeekContext.tsx`: Week selector state (selectedWeek, availableWeeks, setSelectedWeek, loading)

**`server/src/routes/`:**
- Purpose: Domain-grouped API endpoints, request handling, response formatting
- Contains: One file per domain + dashboard aggregation
  - `auth.ts`: Login/logout endpoints (OAuth callback, token generation)
  - `dashboard.ts`: `/api/v1/dashboard/executive-summary`, `/financial-deep-dive`, `/regional-performance` (aggregates data for dashboard views)
  - `financial.ts`: `/api/v1/financial/*` (financial weekly data, KPIs)
  - `projects.ts`: `/api/v1/projects/*` (projects weekly data)
  - `sales.ts`: `/api/v1/sales/*` (sales performance, regional breakdown)
  - `teams.ts`: `/api/v1/teams/*` (team performance, staff metrics)
  - `marketing.ts`: `/api/v1/marketing/*` (leads, performance by platform)
  - `targets.ts`: `/api/v1/targets/*` (create, update, get current for week, history)
  - `uploads.ts`: `/api/v1/uploads/*` (CSV parsing, column mapping, import, history)
  - `weeks.ts`: `/api/v1/weeks/*` (current week, available weeks list)

**`server/src/services/`:**
- Purpose: Business logic, calculations, data transformations isolated from routing
- Contains:
  - `AuthService.ts`: User session (getDevUser, verifyToken, getUserWithPermissions)
  - `WeekService.ts`: Week utilities (toSaturday, validateWeekEnding)
  - `TargetService.ts`: Target resolution by week, creation with history (getTargetForWeek, getAllTargetsForWeek, createTarget, updateTarget)
  - `FinancialService.ts`: Computed metrics (getWeeklySummary, getWeeklyRange, computeDerivedMetrics like profit margin, revenue-to-staff ratio)
  - `CsvParserService.ts`: CSV parsing, delimiter detection, column type inference (parseCsv, validateRows, detectDuplicates)
  - `DataTypeRegistry.ts`: Registry of 15+ importable types with field definitions (getAll, getGrouped, getById)
  - `ImportService.ts`: Row-by-row import with duplicate handling (importRows, rollbackUpload)

**`server/src/middleware/`:**
- Purpose: Cross-cutting concerns: auth, permissions, validation, error handling
- Contains:
  - `auth.ts`: JWT verification (production), dev bypass, attach user to req.user
  - `permissions.ts`: Page-level permission check (requirePermission middleware factory)
  - `validation.ts`: Zod schema validation for query/body (validateQuery, validateBody)
  - `errorHandler.ts`: Centralized error catching and JSON response formatting

**`server/prisma/`:**
- Purpose: Database schema, migrations, type generation
- Contains:
  - `schema.prisma`: 18 table groups (financial_weekly, revenue_weekly, projects_weekly, sales_weekly, sales_regional_weekly, team_performance_weekly, leads_weekly, marketing_performance_weekly, website_analytics_weekly, staff_productivity_weekly, phone_weekly, cash_position_weekly, google_reviews_weekly, targets, target_history, users, user_permissions, column_mappings, upload_audit)

**`server/src/generated/`:**
- Purpose: Prisma-generated files (do not edit manually)
- Contains: Prisma client, type definitions, internal schemas (auto-regenerated on `npx prisma migrate` or `npm run db:generate`)

## Key File Locations

**Entry Points:**
- `server/src/index.ts`: Express server initialization, route mounting, middleware setup
- `client/src/main.tsx`: React app bootstrap (createRoot, StrictMode wrapper)
- `client/src/App.tsx`: Root App component with page routing and state management

**Configuration:**
- `package.json` (root): Monorepo workspace definitions, shared scripts (dev, build, start, migrate)
- `client/tsconfig.json`, `client/tsconfig.app.json`: TypeScript configuration for frontend
- `server/tsconfig.json`: TypeScript configuration for backend
- `client/vite.config.ts`: Vite dev server (localhost:6000), API proxy to localhost:6001
- `.env.example`: Template for required environment variables (DATABASE_URL, JWT_SECRET, OAuth config)
- `CLAUDE.md`: Project instructions, business rules, design language

**Core Logic:**
- `server/src/services/WeekService.ts`: Saturday snapping logic (toSaturday, validateWeekEnding)
- `server/src/services/TargetService.ts`: Active target resolution by week_ending
- `server/src/services/FinancialService.ts`: Derived metric calculations (profit margin, revenue-to-staff ratio)
- `server/src/services/CsvParserService.ts`: CSV parsing and row validation pipeline
- `server/src/services/ImportService.ts`: Import execution with duplicate handling and rollback
- `server/src/services/DataTypeRegistry.ts`: Central registry of 15+ importable data types
- `client/src/lib/WeekContext.tsx`: Global week selection state, Saturday snapping on client

**Testing:**
- Test files location: Not detected. Future test files should follow pattern: `server/src/services/__tests__/`, `client/src/components/__tests__/`

## Naming Conventions

**Files:**
- Services: `PascalCaseService.ts` (e.g., `WeekService.ts`, `FinancialService.ts`)
- Routes: `kebab-case` domain name with `.ts` (e.g., `financial.ts`, `uploads.ts`)
- Components: `PascalCase.tsx` (e.g., `ExecutiveSummary.tsx`, `KPICard.tsx`)
- Context/Hooks: `PascalCase.tsx` (e.g., `WeekContext.tsx`)
- Utilities: `camelCase.ts` (e.g., `api.ts`, `dashboardApi.ts`)
- Middleware: `camelCase.ts` (e.g., `auth.ts`, `errorHandler.ts`)

**Directories:**
- Feature directories: `kebab-case` (e.g., `data-management`, `target-management`)
- Layer directories: `lowercase` (e.g., `components`, `services`, `routes`, `middleware`)
- Generated code: `generated/` (auto-generated, do not edit)

**Functions/Variables:**
- Async functions: Verb-noun pattern (e.g., `fetchExecutiveSummary`, `importRows`, `validateRows`)
- React components: `PascalCase` (e.g., `ExecutiveSummary`, `KPICard`)
- Hooks: `useWeek`, `useCallback`, `useState`, etc. (prefix with `use`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `ALL_REGIONS`, `ADMIN_ONLY_PAGES`, `TABLE_UNIQUE_KEYS`)
- Enums/types: `PascalCase` (e.g., `PageId`, `RowStatus`, `DuplicateStrategy`)

**Imports:**
- Path aliases: Not detected (use relative imports or configure `@/` in tsconfig)
- Order: External modules → sibling files → local utilities
- Example:
  ```typescript
  import { useState } from 'react';
  import { WeekProvider } from './lib/WeekContext';
  import Sidebar from './components/layout/Sidebar';
  ```

## Where to Add New Code

**New Feature (Full Page):**
- Primary code: `client/src/components/dashboard/NewFeatureName.tsx` (component) + `server/src/routes/newfeature.ts` (endpoints) + `server/src/services/NewFeatureService.ts` (logic)
- Tests: `server/src/services/__tests__/NewFeatureService.test.ts`, `client/src/components/__tests__/NewFeatureName.test.tsx`
- API client: `client/src/lib/newfeatureApi.ts` for route-specific queries
- Add navigation item to `Sidebar.tsx` nav items list

**New Component/Module:**
- UI component: `client/src/components/ui/ComponentName.tsx` (for reusable, or `client/src/components/{feature}/ComponentName.tsx` for feature-specific)
- Layout component: `client/src/components/layout/ComponentName.tsx`
- Chart component: `client/src/components/charts/ComponentName.tsx`
- Export from nearest barrel file if one exists, or import directly

**New Service/Business Logic:**
- Implementation: `server/src/services/NewService.ts`
- Pattern: Export static class with async methods (e.g., `class NewService { static async method() {} }`)
- Import in route handler and call synchronously or with await

**New API Endpoint:**
- Route handler: `server/src/routes/domain.ts` (add to existing or create new domain file)
- Pattern: `router.get('/path', middleware, handler)` with try-catch wrapping
- Add auth middleware if protected: `.use(authenticate)` applied in index.ts before route mount
- Add permission check if page-specific: `requirePermission('page_id', 'read' | 'write')` in handler
- Import and mount in `server/src/index.ts` as `app.use('/api/v1/domain', domainRoutes)`

**Utilities/Helpers:**
- Shared utilities: `client/src/lib/utilName.ts` or `server/src/utils/utilName.ts` (create utils dir if needed)
- Format/transform functions: Colocate near where used if single use; move to lib if multi-file

**Database Changes:**
- Update schema: Edit `server/prisma/schema.prisma`
- Generate migration: `npm run migrate` (or `cd server && npx prisma migrate dev --name description`)
- No manual `generated/` edits

## Special Directories

**`server/src/generated/`:**
- Purpose: Prisma-generated client and types
- Generated: Yes (auto-generated by `prisma generate`)
- Committed: Yes (but do not edit manually)
- Rebuild: Run `npx prisma generate` or `npm run migrate` after schema changes

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (created by `npm install`)
- Committed: No (git-ignored)
- Rebuild: `npm install` in root

**`.env` (local, not committed):**
- Purpose: Environment variables (DATABASE_URL, JWT_SECRET, OAuth keys)
- Generated: No (created manually from .env.example)
- Committed: No (git-ignored)
- Required for: Local dev and production deployment

**`.claude/`:**
- Purpose: Claude-specific cached files/context
- Generated: Yes
- Committed: No
- Managed by: Claude editor

**`.planning/codebase/`:**
- Purpose: GSD codebase mapping documents
- Generated: Yes (by /gsd:map-codebase command)
- Committed: Yes (reference for all phases)

---

*Structure analysis: 2026-02-06*
