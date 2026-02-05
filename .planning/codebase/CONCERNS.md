# Codebase Concerns

**Analysis Date:** 2026-02-06

## Tech Debt

**Large dashboard endpoint combining multiple queries:**
- Issue: `/api/v1/dashboard/executive-summary` in `server/src/routes/dashboard.ts` (598 lines) fires 10 parallel queries and computes KPIs in-memory. Risk of cascading failures if one query times out, and payload could become large with 13-week trend data.
- Files: `server/src/routes/dashboard.ts` (lines 31-420)
- Impact: Performance degradation as data volume grows; difficult to debug individual component failures; tight coupling between financial/projects/sales/leads/targets data sources.
- Fix approach: Decompose into separate endpoints (`/executive-summary/financials`, `/executive-summary/projects`, etc.) and cache 13-week aggregates in a materialized view or separate `metrics_cache` table. Consider GraphQL or endpoint query string parameters to fetch only required fields.

**CSV import engine lacks transaction rollback guarantees on partial failure:**
- Issue: In `server/src/services/ImportService.ts` (lines 138-227), if one row fails during the 60s transaction, the entire import aborts. The `rollbackData` is captured (lines 230-234), but if the user never calls `/rollback`, orphaned CSV records remain in the upload history with a `failed` status. No automatic cleanup or timeout expiry.
- Files: `server/src/services/ImportService.ts` (lines 137-280)
- Impact: Database gradually accumulates failed imports; users may not realize they need to manually call rollback; storage inefficiency.
- Fix approach: Add a scheduled job to auto-rollback failed uploads after 7 days, or add a "cleanup" endpoint to purge orphaned uploads. Consider breaking large imports into smaller batches (500 rows at a time) to reduce transaction time and risk.

**Dev auth bypass is always enabled in development:**
- Issue: In `server/src/middleware/auth.ts` (lines 24-32), when `NODE_ENV=development`, the middleware auto-authenticates as a dev user with full Super Admin permissions without requiring a JWT. This is convenient but creates a false sense of security if the env var is accidentally left as `development` in staging/production.
- Files: `server/src/middleware/auth.ts` (lines 23-33)
- Impact: If `.env` is misconfigured or leaked, entire API is accessible without authentication. April (non-technical user) could inadvertently change environment variables.
- Fix approach: Replace dev auth bypass with explicit dev-only endpoint (e.g., `POST /api/v1/auth/dev-login?token=SECRET`) that requires a separate dev-only secret. Remove `NODE_ENV=development` auth bypass entirely; require explicit token even in dev.

**CSV column mapping auto-application at 80% threshold lacks validation:**
- Issue: In `server/src/routes/uploads.ts` (lines 77-150+), the auto-map logic applies a saved mapping if ≥80% of CSV headers match. No validation that the mapping is semantically correct for the data type being imported (e.g., could map currency columns to integer fields). Users might not review misaligned mappings before import.
- Files: `server/src/routes/uploads.ts` (auto-map endpoint), `server/src/services/DataTypeRegistry.ts` (field definitions)
- Impact: Silent data corruption if mapping is semantically wrong (e.g., percentage mapped to currency, stripping decimals). Non-technical user (April) may not catch this.
- Fix approach: Lower auto-apply threshold to 95% or require explicit user confirmation even for high-confidence matches. Add a "preview first 5 rows after mapping" step before auto-applying.

**Type safety issue: `(req as any).validated` bypasses TypeScript type checking:**
- Issue: In `server/src/middleware/validation.ts` (lines 40-42, 56), validated data is attached to request as `(req as any).validated`, which loses type information. Similar pattern in route handlers (e.g., `dashboard.ts` line 33: `(req as any).validated`). If Zod schema changes, TypeScript won't catch type mismatches in route handlers.
- Files: `server/src/middleware/validation.ts`, `server/src/routes/dashboard.ts` (line 33), `server/src/routes/uploads.ts` (multiple)
- Impact: Type errors only caught at runtime; refactoring Zod schemas is error-prone; IDE autocomplete doesn't work for validated data.
- Fix approach: Create a generic `ValidatedRequest<T>` interface extending Express.Request, and use `req as ValidatedRequest<typeof schema>` to preserve type safety. Update all route handlers to use typed request.

**Database Decimal fields lack precision constraints in some tables:**
- Issue: `financial_weekly`, `revenue_weekly`, `projects_weekly` use `@db.Decimal(14, 2)` (14 total digits, 2 decimal places). This allows values up to 99,999,999,999.99. If budget planning assumes 13 digits (e.g., max $999M revenue), an errant upload could create a $10B entry without validation.
- Files: `server/prisma/schema.prisma` (lines 140-156, 160-173, 175-190, etc.)
- Impact: Silently accepts invalid high-value entries; reporting becomes unreliable; no early warning system.
- Fix approach: Add Zod validation in CSV parser (`server/src/services/CsvParserService.ts`) to enforce max/min value ranges per field (e.g., revenue < $10M per week). Add database CHECK constraints for critical fields: `revenue > 0`, `net_profit > -$5M`, etc.

**Empty error handling in error middleware:**
- Issue: In `server/src/middleware/errorHandler.ts` (line 21), generic Error objects are logged as `console.error(err.stack)`, but stack traces are printed to stdout rather than a structured log. No error tracking service (Sentry, DataDog) integrated, and error IDs are not generated for user reference.
- Files: `server/src/middleware/errorHandler.ts` (lines 21-33)
- Impact: Production errors are not tracked centrally; hard to correlate frontend errors with backend logs; April cannot report "error ID 12345" to support.
- Fix approach: Integrate structured logging (e.g., `winston`, `pino`) or error tracking (e.g., Sentry). Generate and return unique error IDs in API responses so users can reference them.

**JWT secret hardcoded default in production:**
- Issue: In `server/src/services/AuthService.ts` (line 6), `JWT_SECRET` defaults to `'dev-secret-change-in-production'` if `process.env.JWT_SECRET` is missing. If the `.env` file is forgotten in production, all JWTs are signed with a known secret, allowing token forgery.
- Files: `server/src/services/AuthService.ts` (line 6)
- Impact: Complete auth bypass if JWT_SECRET env var is not set. Any attacker can forge tokens.
- Fix approach: Remove the default; throw an error at startup if `JWT_SECRET` is missing in production (`NODE_ENV !== 'development'`). Document JWT_SECRET as mandatory.

**CSV parsing does not validate file encoding or detect binary files:**
- Issue: In `server/src/services/CsvParserService.ts` (line 73), files are always decoded as UTF-8. If a user uploads a binary file, Excel file (.xlsx), or non-UTF-8 encoded CSV, the parsing will fail silently or produce garbage data without clear error messaging.
- Files: `server/src/services/CsvParserService.ts` (lines 72-83), `server/src/routes/uploads.ts` (multer fileFilter lines 14-26)
- Impact: Confusing error messages; users may retry multiple times not realizing the issue is file format. Non-technical user (April) could waste time troubleshooting.
- Fix approach: Add magic byte detection to confirm CSV/TSV format before parsing. Return a clear error: "File is not a CSV or TSV. Please export from Excel as CSV (Comma-delimited)." Add file size warning if >5MB (CSV parsing may be slow).

**No pagination on large API responses:**
- Issue: Endpoints like `GET /weeks` and `getAvailableWeeks()` in `server/src/services/WeekService.ts` (lines 80-95) fetch all weeks matching a date range without pagination. If the system has 5 years of data (260+ weeks), every dashboard load could fetch 260+ records.
- Files: `server/src/services/WeekService.ts` (lines 80-95), `server/src/routes/weeks.ts` (likely unbounded SELECT)
- Impact: Slow API responses; large payloads; memory pressure on server; poor performance on slow networks.
- Fix approach: Add `limit` and `offset` query parameters to week endpoints. Default to last 13 weeks. Cache available weeks in memory with TTL.

**Frontend has no error boundary or offline fallback:**
- Issue: In `client/src/App.tsx`, no error boundary component is present. If any child component throws, the entire app crashes. No offline detection; if the API is unreachable, users see blank pages with no messaging.
- Files: `client/src/App.tsx` (lines 1-106)
- Impact: April cannot use the app if the server is temporarily down; silent failures frustrate non-technical users; no automatic retry logic.
- Fix approach: Add a React error boundary to catch component errors and show a user-friendly message. Implement API retry logic with exponential backoff. Add an offline indicator in TopBar using navigator.onLine.

**No input validation on Region/ProjectType/SalesType enums:**
- Issue: When CSV data is imported, fixed fields like `projectType: 'residential'` are applied without checking if the value exists in the Prisma enum. If DataTypeRegistry is updated with a typo (e.g., `'residencial'`), Prisma will reject the insert.
- Files: `server/src/services/DataTypeRegistry.ts` (fixedFields), `server/src/services/ImportService.ts` (line 209: fixedFields applied)
- Impact: Cryptic Prisma errors during import; rollback required. If the typo is in a frequently-used data type, all imports of that type fail.
- Fix approach: Validate fixedFields against the Prisma enums at startup. Add a registry health check that ensures all enums in DataTypeRegistry match the Prisma schema.

## Known Bugs

**Week snapping logic does not handle month/year boundaries correctly:**
- Symptoms: If a date is on Sunday the 31st of month, and it's within 3 days of Saturday the 28th, `WeekService.toSaturday()` may snap backward to the previous Saturday (28th), crossing a month boundary. This could cause financial data to be associated with the "wrong" week if the user expects weeks to be within a single month.
- Files: `server/src/services/WeekService.ts` (lines 19-26)
- Trigger: Input dates near month-ends (e.g., January 31st should snap to January 25th, not January 18th)
- Workaround: All dates in CSV uploads should be explicitly corrected to Saturdays before upload. Users should verify week_ending dates in the preview step.

**Revenue-to-Staff Ratio KPI logic not visible in code:**
- Symptoms: The dashboard likely calculates "Revenue to Staff Ratio" = (Wages & Salaries / Total Trading Income) × 100, but the formula is not explicitly implemented in the visible routes. If recalculation is needed, there's no single place to update it.
- Files: `server/src/routes/dashboard.ts` (executive-summary endpoint) — calculation either missing or commented out
- Trigger: Viewing Executive Summary KPI card for "Revenue to Staff Ratio"
- Workaround: Manually calculate as (WagesAndSalaries / TotalTradingIncome) × 100 if needed. Document the formula in code.

## Security Considerations

**CORS is enabled globally with no origin whitelist:**
- Risk: `server/src/index.ts` (line 22) calls `app.use(cors())` without configuration. This allows any origin to make requests to the API, including cross-site attacks from malicious domains.
- Files: `server/src/index.ts` (line 22)
- Current mitigation: None. Auth token is required, but a compromised user account or leaked token could be exploited from any origin.
- Recommendations: Whitelist only `http://localhost:6000` (dev) and the production domain. Example: `app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:6000' }))`.

**User role defaults may not match business intent:**
- Risk: In `server/src/middleware/permissions.ts` (lines 9-14), new users default to `staff` role (line 91 in AuthService), which has very limited access. If a director accidentally registers before an admin can promote them, they'll see "no access" errors.
- Files: `server/src/middleware/permissions.ts`, `server/src/services/AuthService.ts` (line 91)
- Current mitigation: Requires admin to explicitly upgrade roles after first login.
- Recommendations: Send a registration confirmation email with a link to claim admin status if they're in a known list of directors. Or require an invite code.

**CSV upload file size limit (10MB) may be bypassed or too permissive:**
- Risk: Multer limits uploads to 10MB, but a 10MB CSV could contain hundreds of thousands of rows. Processing 500k rows in a 60s transaction could cause database lock and block other users.
- Files: `server/src/routes/uploads.ts` (line 16)
- Current mitigation: 60s transaction timeout (ImportService.ts line 227).
- Recommendations: Reduce file size limit to 2MB or reduce row limit to 10k rows per import. Add a "batched import" mode for large files.

**No rate limiting on API endpoints:**
- Risk: An attacker could send rapid requests to `/import` or `/validate` endpoints, consuming server CPU and database connections.
- Files: All route files in `server/src/routes/`
- Current mitigation: None.
- Recommendations: Add `express-rate-limit` middleware. Limit to 10 requests/minute per user for `/import`, 100/minute for read endpoints.

**Password-less auth (M365 SSO) is not enforced in production:**
- Risk: If Azure AD is not configured (`AZURE_AD_CLIENT_ID` missing), the app falls back to a default dev user with Super Admin access. No alternative auth method is offered.
- Files: `server/src/middleware/auth.ts` (lines 25-32), `server/src/services/AuthService.ts` (lines 10-26)
- Current mitigation: Dev bypass is documented in `.env.example`.
- Recommendations: In production, ensure `AZURE_AD_CLIENT_ID` is set or the app fails to start. Add an unauthenticated login page that explains "Contact your administrator to set up access."

## Performance Bottlenecks

**Executive summary loads 10 parallel queries for each page load:**
- Problem: `/executive-summary` fires queries for financial, projects, sales, leads, cash, reviews, teams, and targets in parallel. If any query is slow (e.g., 13-week trend on projects_weekly with no index), the page load blocks until all queries complete.
- Files: `server/src/routes/dashboard.ts` (lines 40-90)
- Cause: No database indexes on `weekEnding` in trend tables; no caching of computed KPIs.
- Improvement path: Add indexes on `financial_weekly(weekEnding)`, `projects_weekly(weekEnding)`, etc. Cache executive summary for 1 hour in Redis or in-memory. Implement pagination for 13-week data (return only the last 13 weeks, not all history).

**Dashboard route is highly coupled to data schema changes:**
- Problem: If a new metric (e.g., "Customer Satisfaction Score") is added to the schema, the dashboard route must be updated and redeployed. No flexible query mechanism exists.
- Files: `server/src/routes/dashboard.ts` (598 lines of hardcoded queries and calculations)
- Cause: RESTful design with fixed response shapes; no GraphQL or flexible query language.
- Improvement path: Consider GraphQL for dashboard to allow frontend to request only needed fields. Or add a "custom metrics" query parameter that allows dashboard to be configured without backend changes.

**CSV parsing uses string operations instead of streaming for large files:**
- Problem: `server/src/services/CsvParserService.ts` (line 72) converts entire file buffer to string. A 10MB CSV is loaded entirely into memory before parsing begins.
- Files: `server/src/services/CsvParserService.ts` (lines 72-120)
- Cause: PapaParse's `parse()` is synchronous and does not stream.
- Improvement path: Switch to a streaming CSV parser (e.g., `csv-parser` or `fast-csv`) that processes rows one at a time. This allows handling 100MB+ files on resource-constrained servers.

**getExistingWeeks() queries entire table for duplicate detection:**
- Problem: In `server/src/routes/uploads.ts` (lines 265-285), duplicate detection fetches ALL `weekEnding` values from the target table (e.g., `SELECT weekEnding FROM financial_weekly`). For a table with 10,000 rows, this is inefficient.
- Files: `server/src/routes/uploads.ts` (lines 265-285)
- Cause: No pagination or indexed DISTINCT query.
- Improvement path: Use a single `SELECT DISTINCT weekEnding FROM table WHERE weekEnding BETWEEN ? AND ?` query with a date range. Add an index on `weekEnding` in all `*_weekly` tables.

## Fragile Areas

**ImportService rollback uses generic `Record<string, any>` for overwritten data:**
- Files: `server/src/services/ImportService.ts` (lines 35-44: RollbackData interface)
- Why fragile: The `previousData` field is typed as `Record<string, any>`, so Prisma type information is lost. If a field is renamed in the Prisma schema (e.g., `newBusinessPercentage` → `newBizPct`), the rollback data could become stale or cause update errors.
- Safe modification: Strongly type RollbackData by table (e.g., `interface FinancialRollback { previousData: FinancialWeekly }`). Or store the full record object (not just modified fields) so rollback simply restores the entire row.
- Test coverage: No unit tests for rollback logic visible in codebase. Integration test needed: upload → modify → rollback → verify data matches original.

**DataTypeRegistry is a large static object with no validation:**
- Files: `server/src/services/DataTypeRegistry.ts` (412 lines)
- Why fragile: If a field is renamed (e.g., `dbField: 'weekEnding'` → `dbField: 'week_ending'`), the entire import flow breaks. No compile-time check that all `dbField` values exist in Prisma schema.
- Safe modification: Generate DataTypeRegistry from Prisma schema at build time using `prisma-internals`, or add a startup validation that checks all `dbField` values against the Prisma schema.
- Test coverage: No unit tests for DataTypeRegistry visible. Add schema validation tests.

**CSV validation uses manual string parsing for dates, currency, percentages:**
- Files: `server/src/services/CsvParserService.ts` (lines 144-258: parseDate, parseCurrency, parsePercentage, parseNumeric)
- Why fragile: Multiple regex patterns and string operations. Edge cases like "($1,234)" for negative currency or "54%" vs "0.54" percentage could have subtle bugs (e.g., what if someone writes "($1,234.56)"?).
- Safe modification: Use a robust library like `dinero.js` for currency parsing or `decimal.js` for precision. Add comprehensive unit tests for parseDate, parseCurrency, parsePercentage with 50+ test cases each (including edge cases like null, empty, whitespace, scientific notation).
- Test coverage: No visible test files for CsvParserService.

**Target service does not validate effective_from/effective_to date ranges:**
- Files: `server/src/services/TargetService.ts` (likely contains `getTargetForWeek()` logic)
- Why fragile: If a target record has `effective_from` > `effective_to`, the service may return null or crash. No validation at insert time.
- Safe modification: Add Zod schema for targets that enforces `effective_from < effective_to`. Add database CHECK constraint: `effective_from < effective_to`.
- Test coverage: No visible test files for TargetService.

## Scaling Limits

**Single PostgreSQL database is a single point of failure:**
- Current capacity: Schema supports multiple users, but no replication/failover is configured. All data writes go to a single database instance.
- Limit: If the database server fails, the entire app is down. No automatic failover.
- Scaling path: Set up PostgreSQL with streaming replication (primary + standby). Use a connection pooler like PgBouncer. In production, consider managed PostgreSQL (AWS RDS, Azure Database, Heroku Postgres) with automated backups and failover.

**In-memory Prisma client is not pooled:**
- Current capacity: `server/src/db.ts` creates a single PrismaClient instance. Each Express process has its own connection pool.
- Limit: If the app is deployed with multiple processes (e.g., 4 Node.js workers), each will have 10 database connections by default (40 total). A busy server could exhaust PostgreSQL's max_connections limit.
- Scaling path: Set up a connection pooler (PgBouncer or pgAgent) between Node.js and PostgreSQL. Reduce the connection pool size in Prisma config: `datasource db { connectionLimit = 5 }`.

**CSV import transaction timeout is hardcoded at 60 seconds:**
- Current capacity: Large imports (10k+ rows) must complete within 60s or the transaction aborts.
- Limit: Complex data types with many unique key checks could exceed 60s on slow hardware.
- Scaling path: Make timeout configurable via environment variable. Implement batched imports (process rows in chunks of 500, commit after each batch). Monitor import duration and alert if average > 30s.

**No database connection pooling or caching layer:**
- Current capacity: Every API request performs at least 1-2 database queries.
- Limit: With many concurrent users, database connections will saturate. Dashboard queries (10 parallel queries) consume significant resources.
- Scaling path: Add Redis caching layer for executive summary (cache for 5 minutes). Cache week list for 1 hour. Implement materialized views for expensive aggregations (e.g., 13-week trend data).

## Dependencies at Risk

**Multer 1.4.5-lts.1 is legacy:**
- Risk: Multer 1.4.x is in "long-term support" but not actively developed. New security vulnerabilities may not be patched.
- Impact: File upload vulnerabilities (e.g., symlink attacks, TOCTOU) could be exploited.
- Migration plan: Upgrade to Multer 2.0+ (in beta/release candidate state as of 2025) or switch to a maintained alternative like `busboy` or `formidable`.

**Papaparse 5.5.2 has no TypeScript types in main package:**
- Risk: Types are from `@types/papaparse`, which is community-maintained and may lag behind the library.
- Impact: Type mismatches when PapaParse API changes; CSV parsing could silently produce incorrect output.
- Migration plan: Consider `csv-parser` (has built-in types and is actively maintained) or `fast-csv` as alternatives.

**Prisma Client is generated code (brittle after schema changes):**
- Risk: `server/src/generated/prisma/` is auto-generated. If hand-edited, changes will be overwritten. If Prisma version updates, generated code could break.
- Impact: Difficult to diff generated files in git; merge conflicts in generated code; risk of data access layer breaking after migration.
- Migration plan: Keep generated code out of version control (add to `.gitignore`) and regenerate on install. Or use Prisma's latest generated client (v6.3.0 is current).

## Test Coverage Gaps

**No unit tests for CsvParserService:**
- What's not tested: `parseDate()`, `parseCurrency()`, `parsePercentage()`, `parseNumeric()` functions with edge cases (empty strings, null, whitespace, malformed input).
- Files: `server/src/services/CsvParserService.ts` (lines 144-258)
- Risk: Silent data corruption from parsing bugs. Non-technical user uploads data, receives no error, but currency values are interpreted as percentages.
- Priority: **High** — This is the most critical data pipeline.

**No integration tests for CSV upload workflow:**
- What's not tested: End-to-end upload flow (parse → auto-map → validate → import → verify in database). No test for rollback. No test for duplicate detection.
- Files: `server/src/routes/uploads.ts`, `server/src/services/ImportService.ts`
- Risk: Breaking changes to upload flow are not caught. A bug in auto-map logic could go unnoticed for days.
- Priority: **High** — CSV upload is the most critical feature per CLAUDE.md.

**No tests for permission middleware:**
- What's not tested: `requirePermission()` middleware. Does a staff user actually get denied access to admin pages? Does role escalation work correctly?
- Files: `server/src/middleware/permissions.ts`
- Risk: Permission bypass or unexpected access denial in production.
- Priority: **Medium** — Security-critical but less frequently changed.

**No tests for WeekService date snapping logic:**
- What's not tested: `toSaturday()` with dates near month/year boundaries, leap years, etc.
- Files: `server/src/services/WeekService.ts`
- Risk: Financial data incorrectly associated with the wrong week due to date snapping bugs.
- Priority: **Medium** — Important for data accuracy but low-complexity logic.

**No tests for dashboard KPI calculations:**
- What's not tested: Revenue-to-Staff Ratio calculation, variance calculations, percentage-to-target calculations.
- Files: `server/src/routes/dashboard.ts` (lines 92-300+)
- Risk: Incorrect KPI values shown to directors; bad business decisions based on wrong numbers.
- Priority: **Medium** — High business impact but calculation logic is simple.

**Frontend has no unit tests:**
- What's not tested: React components, API client calls, state management, error boundaries.
- Files: `client/src/` (all 35 files)
- Risk: UI bugs not caught until manual testing; regression in month-long build.
- Priority: **Low** — Frontend logic is currently simple (mostly displays); risk is lower than backend.

---

*Concerns audit: 2026-02-06*
