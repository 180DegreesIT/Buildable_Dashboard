# External Integrations

**Analysis Date:** 2026-02-06

## APIs & External Services

**Microsoft 365 / Azure AD (M365 SSO):**
- Service: Microsoft Entra ID (Azure AD) OAuth 2.0
- What it's used for: User authentication and single sign-on for company M365 directory
- SDK/Client: `@azure/msal-node` 5.0.3
- Implementation: `server/src/services/AuthService.ts` (getMsalClient, getAuthUrl, handleCallback)
- Auth: Environment variables `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`
- Status: **Scaffolded, optional in dev** — If not configured, M365 SSO unavailable; dev mode auto-authenticates
- Redirect URI: `http://localhost:6001/api/v1/auth/callback`
- Scopes: `user.read`, `openid`, `profile`, `email`
- Auto-provisioning: On first M365 login, user created in database with `m365Id` and auto-assigned `staff` role

**Xero API (Phase 1 scaffold, not implemented):**
- Service: Xero accounting software API
- What it's used for: Planned integration for financial data import (invoiced amounts, P&L data)
- SDK/Client: Not installed yet (pending implementation)
- Auth: Placeholder env vars `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`
- Redirect URI: `http://localhost:6001/api/v1/xero/callback`
- Status: **Infrastructure stubbed**, no active integration

**3CX API (Phase 3, not implemented):**
- Service: 3CX phone system
- What it's used for: Phone metrics integration (call counts, duration, etc.)
- Auth: Placeholder env vars `THREECX_CLIENT_ID`, `THREECX_CLIENT_SECRET`
- Status: **Phase 3 milestone**, not yet developed

## Data Storage

**Databases:**

**PostgreSQL (Primary):**
- Connection: `DATABASE_URL` environment variable (e.g., `postgresql://user:password@localhost:5432/buildable_dashboard?schema=public`)
- Client: Prisma ORM 6.3.0 (`@prisma/client`)
- Schema: `server/prisma/schema.prisma` (18 table groups)
- ORM Features: Type-safe query builder, auto-generated TypeScript types in `server/src/generated/prisma/`
- Data Pattern: All monetary values use `Decimal` type (not Float), dates stored as ISO strings (always Saturday for `week_ending` fields)
- Tables: `financial_weekly`, `revenue_weekly`, `projects_weekly`, `sales_weekly`, `teams_weekly`, `marketing_weekly`, `targets`, `target_history`, `users`, `user_permissions`, `csv_uploads`, `csv_column_mappings`, `cash_position_weekly`, `google_reviews_weekly`, `leads_weekly`, `marketing_performance_weekly`, `phone_weekly`, `staff_productivity_weekly`, `upcoming_liability_weekly`, `website_analytics_weekly`
- Enums: `DataSource` (csv_upload, xero_api, manual_entry, backfilled), `ProjectType`, `SalesType`, `Region`, `LeadSource`, `MarketingPlatform`, `RevenueCategory`, `UserRole`, `PermissionLevel`, `UploadStatus`, `TargetType`

**File Storage:**
- Type: Memory-based file uploads via Multer (`server/src/routes/uploads.ts`)
- Approach: Files received in multipart form data, parsed in-memory (10MB max), data extracted and stored in database only
- No persistent file storage (no S3, no disk cache)

**Caching:**
- Type: None implemented
- Future consideration: Could cache financial/sales data summaries for performance

## Authentication & Identity

**Auth Provider:**
- Primary: Microsoft Entra ID (Azure AD) OAuth 2.0 via MSAL Node
- Implementation: `server/src/services/AuthService.ts`
- Token Type: JWT signed with `JWT_SECRET` env var
- Token Expiry: 8 hours (`JWT_EXPIRY = '8h'`)
- Header: `Authorization: Bearer <jwt>`
- Dev Bypass: In `NODE_ENV=development`, all requests auto-authenticate as configured dev user with Super Admin role (no token required)
- User Auto-Provisioning: First M365 login creates database user with `m365Id` and `email`, defaults to `staff` role
- Endpoints:
  - `GET /api/v1/auth/login` - Redirects to M365 or returns dev token
  - `GET /api/v1/auth/callback` - OAuth callback handler
  - `GET /api/v1/auth/me` - Return current user profile with permissions
  - `POST /api/v1/auth/logout` - Stateless logout (client discards token)
  - `GET /api/v1/auth/status` - Check if SSO configured and dev mode active

**Permissions Model:**
- Roles: `super_admin`, `executive`, `manager`, `staff`
- Access Control: `requirePermission(page, level)` middleware in `server/src/middleware/permissions.ts`
- Permission Levels: `read`, `write`, `no_access`
- Storage: `user_permissions` table linked to users

## Monitoring & Observability

**Error Tracking:**
- Type: Not detected
- Approach: Express error handler middleware (`server/src/middleware/errorHandler.ts`) catches and logs errors
- Response format: `{ error: { message, statusCode } }`

**Logs:**
- Type: Not detected
- Approach: `console.log()` / `console.error()` for server startup and debug info
- No structured logging framework (Pino, Winston, etc.) implemented

**Health Check:**
- Endpoint: `GET /api/health` (unauthenticated)
- Response: `{ status: 'ok' }`
- Purpose: Container/load balancer health monitoring

## CI/CD & Deployment

**Hosting:**
- Platform: Windows 11 local server (project instructions note all paths/configs must be platform-agnostic)
- Start/Stop: `start-dashboard.bat` / `stop-dashboard.bat` scripts
- No Docker or cloud deployment currently configured

**CI Pipeline:**
- Type: None detected
- Build: Manual `npm run build` and `npm run dev` for development
- Deployment: Manual copy/run of start scripts

**Port Configuration:**
- Client dev: `http://localhost:6000` (Vite server with API proxy)
- Server: `http://localhost:6001`
- Both hardcoded in configs (`vite.config.ts`, environment defaults)

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string (required, no default)
- `PORT` - Server port (defaults to 6001 if not set)
- `NODE_ENV` - "development" or "production" (controls auth bypass)
- `JWT_SECRET` - Secret key for signing JWTs (dev default: "dev-secret-change-in-production")
- `DEV_USER_EMAIL` - Dev auth user email (defaults to "admin@buildable.com.au")
- `DEV_USER_NAME` - Dev auth user display name (defaults to "Dev Admin")
- `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` - M365 SSO (optional, required only if SSO enabled)
- `AZURE_AD_REDIRECT_URI` - M365 callback URL (defaults to "http://localhost:6001/api/v1/auth/callback")
- `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI` - Xero integration (optional, Phase 1 scaffold)
- `THREECX_CLIENT_ID`, `THREECX_CLIENT_SECRET` - 3CX integration (optional, Phase 3 future)

**Secrets location:**
- `.env` file at `server/.env` (Git-ignored, not committed)
- Template: `.env.example` at project root documents all variables
- Access pattern: `process.env.VARIABLE_NAME` loaded via `dotenv.config()` in `server/index.ts`

## Webhooks & Callbacks

**Incoming:**
- OAuth Callbacks:
  - `GET /api/v1/auth/callback` (M365 OAuth code exchange)
  - `GET /api/v1/xero/callback` (Xero OAuth, scaffolded but not implemented)

**Outgoing:**
- None detected
- Future consideration: Could emit webhooks for CSV upload completion, data validation failures, etc.

## CSV Upload System

**Integration Points:**
- Upload Endpoint: `POST /api/v1/uploads/parse` (file upload, returns parsed preview)
- Data Type Registry: `GET /api/v1/uploads/data-types` (list importable data types)
- Auto-Mapping: `POST /api/v1/uploads/auto-map` (find saved mappings)
- Validation: `POST /api/v1/uploads/validate` (validate rows with mappings)
- Import: `POST /api/v1/uploads/confirm` (commit validated data to database)
- Mapping Storage: `csv_column_mappings` table (auto-apply if ≥80% match)

**Supported Data Types (15+):**
- Financial: P&L, Revenue Breakdown, Cash Position
- Projects: Residential, Commercial, Retrospective
- Sales: Residential, Commercial, Retrospective
- Regional Sales: By region (9 regions)
- Marketing: Website Analytics, Google Reviews, Marketing Performance, Leads
- Teams: Staff Productivity, Team Performance
- Phone: Phone Metrics
- Targets: Net Profit, Revenue, Various KPIs
- Other: Upcoming Liabilities

**Validation Rules:**
- Delimiter detection: Auto-detects `,`, `\t`, `;`
- Date parsing: DD/MM/YYYY (Australian format) or ISO YYYY-MM-DD, auto-corrects to nearest Saturday (within 3 days)
- Currency: Strips `$`, `,`, handles parenthetical negatives
- Percentage: Normalizes to decimal (54% → 0.54)
- Type inference: Samples first 20 rows to infer column types
- Duplicate detection: Checks `week_ending` values against existing database records
- Blank row handling: Skips and counts blank rows separately

---

*Integration audit: 2026-02-06*
