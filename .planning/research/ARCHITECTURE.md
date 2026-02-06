# Architecture Research

**Domain:** Business dashboard -- remaining feature integration (Excel migration, admin settings, permissions, PDF generation, Xero OAuth2, export service)
**Researched:** 2026-02-06
**Confidence:** HIGH (codebase analysis) / MEDIUM (library recommendations -- web verification unavailable)

## Existing Architecture Summary

The codebase follows a layered monorepo pattern. Understanding this is essential for knowing where each new capability slots in.

```
C:/Projects/buildable_dashboard/
+---------+----------------------------------+-----------------------------------+
|         |           CLIENT (React)          |          SERVER (Express)          |
|         |  client/src/                      |  server/src/                       |
|         |    App.tsx (page routing)          |    index.ts (Express + middleware)  |
|         |    components/                    |    routes/ (domain-grouped)        |
|         |      dashboard/ (page views)      |    services/ (business logic)      |
|         |      upload/ (CSV wizard)         |    middleware/ (auth, perms, err)   |
|         |      targets/ (CRUD UI)           |    generated/prisma/ (ORM types)   |
|         |      layout/ (shell, sidebar)     |  prisma/schema.prisma              |
|         |      ui/ (KPI, DataTable, etc)    |                                    |
|         |    lib/ (API wrappers, context)   |                                    |
+---------+----------------------------------+-----------------------------------+
|         |                    PostgreSQL (18 table groups)                       |
+---------+----------------------------------------------------------------------+
```

**Established Patterns (HIGH confidence -- observed in codebase):**

| Pattern | Where Used | Convention |
|---------|-----------|------------|
| Domain-grouped routes | `server/src/routes/*.ts` | One file per domain, Router exported |
| Service layer classes | `server/src/services/*.ts` | Static methods, direct Prisma calls |
| Auth middleware chain | `server/src/index.ts` line 34 | `app.use('/api/v1', authenticate)` applied globally |
| Permission middleware | Route-level | `requirePermission('page_name', 'read')` |
| Frontend API wrappers | `client/src/lib/*.ts` | Typed fetch functions, one file per domain |
| React Context for global state | `client/src/lib/WeekContext.tsx` | Provider wraps App, `useWeek()` hook |
| Page-level component routing | `client/src/App.tsx` | Conditional render based on `activePage` state |
| Prisma singleton | `server/src/db.ts` | Single import shared across all services |
| Zod validation middleware | `server/src/middleware/validation.ts` | `validateQuery()`, `validateBody()` on routes |

---

## Capability 1: Excel Migration Scripts

### Where It Fits

Migration scripts are **one-time utilities**, not runtime server code. They belong outside the main server application.

**Recommended location:**

```
server/
  scripts/
    migrate-excel.ts          # Main orchestrator script
    excel-readers/
      weekly-report.ts        # "Weekly Report" sheet reader (transposed)
      finance-this-week.ts    # "Finance This Week" sheet reader
      sales-weekly.ts         # "Sales Weekly" sheet reader
      marketing-weekly.ts     # "Marketing Weekly" sheet reader
      operations-weekly.ts    # "Operations Weekly" sheet reader
      phone.ts                # "Phone" sheet reader
    excel-utils.ts            # Shared: transpose, date parsing, cell cleaning
```

**Rationale:** Placing scripts under `server/scripts/` keeps them adjacent to Prisma and the database layer (they need `prisma` imports), but separated from runtime route/service code. They run via `tsx server/scripts/migrate-excel.ts`, not through Express.

### Data Flow

```
Weekly_Report__30.xlsx (12 sheets, transposed layout)
    |
    v
exceljs reads workbook
    |
    v
Per-sheet reader extracts data:
  - Identify header row (week dates in columns)
  - Identify metric rows (labels in first column)
  - Transpose: for each column (week), create a row record
  - Parse dates -> snap to Saturday via WeekService
  - Parse currencies -> strip $, commas, handle #REF!, #DIV/0!
    |
    v
Transform to Prisma schema shape
    |
    v
Prisma upsert (idempotent) with data_source: 'backfilled'
    |
    v
Log: rows imported, skipped, errors per sheet
```

### Transposed Layout Handling

The key challenge: Excel has **weeks as columns, metrics as rows** (opposite of database schema where each row is one week's data). This is a transpose operation.

**Pattern: Column-to-Row Transposition**

```typescript
// Pseudocode for the transposition pattern
interface TransposedSheet {
  metricLabels: string[];        // Column A values (row labels)
  weekDates: Date[];             // Row 5 values (column headers)
  cells: (string | number | null)[][]; // [metricIndex][weekIndex]
}

function transposeToRecords(sheet: TransposedSheet): Record<string, any>[] {
  const records: Record<string, any>[] = [];
  for (let weekIdx = 0; weekIdx < sheet.weekDates.length; weekIdx++) {
    const record: Record<string, any> = {
      weekEnding: snapToSaturday(sheet.weekDates[weekIdx]),
    };
    for (let metricIdx = 0; metricIdx < sheet.metricLabels.length; metricIdx++) {
      const field = labelToDbField(sheet.metricLabels[metricIdx]);
      if (field) {
        record[field] = cleanCellValue(sheet.cells[metricIdx][weekIdx]);
      }
    }
    records.push(record);
  }
  return records;
}
```

### Library Recommendation

**Use `exceljs`** because:
- It reads .xlsx files natively in Node.js (no Python dependency)
- Supports cell-by-cell access via row/column coordinates (essential for transposed reading)
- Handles merged cells, date serial numbers, and formula results
- Already in the Node.js ecosystem (no cross-language bridge needed)
- The project already uses TypeScript; `exceljs` has TypeScript declarations

**Confidence: MEDIUM** -- exceljs is well-established (training data), but cannot verify current version via web. Alternative: `xlsx` (SheetJS) is also viable but has a less intuitive API for coordinate-based access.

**Key concern:** The "Weekly Report" sheet has multiple distinct data sections (Financial, Projects, Sales, Leads, Teams) stacked vertically. Each section needs its own reader logic to identify where it starts/ends in the row layout.

### Integration with Existing Code

- **Reuse `WeekService.snapToSaturday()`** for date normalisation (same logic as CSV imports)
- **Reuse `TABLE_UNIQUE_KEYS` from ImportService** for idempotent upsert logic
- **Use Prisma directly** (not through ImportService), since migration scripts do not need upload tracking, rollback, or UI feedback
- **Set `dataSource: 'backfilled'`** on all records (existing enum value in schema)

### Build Order Implication

Excel migration has **no dependencies on other new features** (admin settings, exports, Xero). It only needs the existing schema. Can be built first or in parallel with everything else.

---

## Capability 2: Admin Settings Backend

### Where It Fits

The `Setting` model already exists in the Prisma schema:

```prisma
model Setting {
  id        Int      @id @default(autoincrement())
  key       String   @unique
  value     Json
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  @@map("settings")
}
```

This is the **key-value JSON pattern** -- each setting is a unique key with a JSON value. This is already the right pattern for the use cases:

**New files needed:**

```
server/src/
  routes/settings.ts          # CRUD for settings (admin-only)
  services/SettingsService.ts  # Typed getters with defaults, caching

client/src/
  lib/settingsApi.ts           # Frontend API wrapper
  components/admin/
    AdminSettings.tsx           # Main admin page
    BrandingSection.tsx         # Logo upload, colour config
    PassthroughConfig.tsx       # Pass-through items list editor
    AlertThresholds.tsx         # Threshold config cards
    SystemStatus.tsx            # Xero/3CX connection status
```

### Settings Data Model

**Recommended settings keys and shapes:**

```typescript
interface SettingsMap {
  'branding': {
    companyName: string;
    logoUrl: string | null;      // stored as base64 data URI or file path
    primaryColour: string;        // hex
    accentColour: string;         // hex
  };
  'passthrough_items': string[];  // e.g. ['council_fees', 'insurance_levy']
  'alert_thresholds': {
    netProfitBelowBudget: { enabled: boolean; consecutiveWeeks: number };
    teamBelowTarget: { enabled: boolean; percentThreshold: number };
    conversionRateBelow: { enabled: boolean; percentThreshold: number };
    cashNearOverdraft: { enabled: boolean; dollarThreshold: number };
  };
  'xero_connection': {
    status: 'connected' | 'disconnected' | 'token_expiring';
    lastSync: string | null;
    tenantId: string | null;
  };
  'backup_info': {
    lastBackup: string | null;
    location: string | null;
  };
}
```

### Pattern: SettingsService with Defaults

```typescript
// Pattern for typed settings access with fallback defaults
export class SettingsService {
  private static defaults: Record<string, any> = {
    passthrough_items: ['council_fees', 'insurance_levy'],
    alert_thresholds: { /* ... */ },
    branding: { companyName: 'Buildable Approvals', primaryColour: '#4573D2' },
  };

  static async get<K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K]> {
    const setting = await prisma.setting.findUnique({ where: { key } });
    return (setting?.value as SettingsMap[K]) ?? this.defaults[key];
  }

  static async set<K extends keyof SettingsMap>(key: K, value: SettingsMap[K]): Promise<void> {
    await prisma.setting.upsert({
      where: { key },
      update: { value: value as any },
      create: { key, value: value as any },
    });
  }
}
```

### How Branding/Config Flows Through the App

```
Admin Settings UI
    |
    v (POST /api/v1/settings/branding)
SettingsService.set('branding', {...})
    |
    v (stored in settings table as JSON)

Other components read on demand:

TopBar.tsx
    |
    v (GET /api/v1/settings/branding on mount)
    Renders logo, company name from settings

PDF Export Service
    |
    v (SettingsService.get('branding'))
    Injects logo/name into PDF header

Financial Deep Dive (Net Revenue toggle)
    |
    v (GET /api/v1/settings/passthrough_items)
    Filters revenue categories based on pass-through list
```

**Key insight:** The financial views already have a Net Revenue toggle in the UI (`NetRevenueToggle.tsx`). Currently pass-through items are likely hardcoded. The admin settings feature makes this configurable by storing the list in the `settings` table and having the financial endpoints query it.

### Integration with Existing Code

- **Route registration:** Add `app.use('/api/v1/settings', settingsRoutes)` in `index.ts` (same pattern as other routes)
- **Permission:** `requirePermission('admin_settings', 'write')` for mutations, `'read'` for fetches
- **Logo storage:** Store as base64 data URI in the JSON value (simple, no file system dependency). Max size ~500KB encoded is acceptable for a company logo.
- **Branding consumption:** Frontend fetches branding on app mount and stores in a BrandingContext or in a simple module-level cache.

### Build Order Implication

Admin settings is **foundational for other features**:
- PDF export needs branding settings (logo, company name)
- Financial views need pass-through items list
- Xero integration writes connection status to settings

**Recommendation: Build admin settings early** (before PDF export and Xero).

---

## Capability 3: Permission Matrix UI

### Where It Fits

The permission model already exists and works:

- **Schema:** `UserPermission` model with `userId_page` unique constraint
- **Middleware:** `requirePermission()` resolves explicit permissions, then falls back to role defaults
- **Roles:** `super_admin`, `executive`, `manager`, `staff`
- **Pages:** 13 `DashboardPage` enum values
- **Levels:** `read`, `write`, `no_access`

The remaining work is purely a **CRUD UI** for managing the permission matrix.

**New files needed:**

```
server/src/
  routes/users.ts              # User CRUD + permission matrix endpoints

client/src/
  lib/userApi.ts               # Frontend API wrapper
  components/admin/
    UserManagement.tsx           # Main user list page
    UserEditModal.tsx            # Edit role, team, region
    PermissionMatrix.tsx         # Grid: users x pages x levels
```

### Efficient Storage Pattern

The current schema is already optimal:

```
user_permissions table:
  userId + page -> unique constraint
  permissionLevel: read | write | no_access
```

Only **explicit overrides** are stored. Role defaults handle the rest. For a small user base (< 50 users, 13 pages), this means at most ~650 rows -- trivially small.

### Query Pattern for the Matrix Grid

```typescript
// GET /api/v1/users/permissions-matrix
// Returns: { users: [...], matrix: { [userId]: { [page]: level } } }

const users = await prisma.user.findMany({
  where: { isActive: true },
  include: { permissions: true },
  orderBy: { displayName: 'asc' },
});

const matrix = users.map(user => ({
  id: user.id,
  displayName: user.displayName,
  email: user.email,
  role: user.role,
  permissions: Object.fromEntries(
    ALL_PAGES.map(page => {
      const explicit = user.permissions.find(p => p.page === page);
      return [page, explicit?.permissionLevel ?? resolveDefault(user.role, page)];
    })
  ),
}));
```

### Bulk Update Pattern

The matrix UI should support batch updates (toggle multiple cells, then save):

```typescript
// PUT /api/v1/users/:id/permissions
// Body: { permissions: { executive_summary: 'read', financial_deep_dive: 'write', ... } }

// Use upsert for each permission, delete entries that match role default
await prisma.$transaction(
  Object.entries(permissions).map(([page, level]) => {
    const isDefault = level === resolveDefault(user.role, page);
    if (isDefault) {
      // Remove explicit override (fall back to role default)
      return prisma.userPermission.deleteMany({
        where: { userId, page: page as DashboardPage },
      });
    }
    return prisma.userPermission.upsert({
      where: { userId_page: { userId, page: page as DashboardPage } },
      update: { permissionLevel: level },
      create: { userId, page: page as DashboardPage, permissionLevel: level },
    });
  })
);
```

**Key insight:** Only store overrides. When a cell matches the role default, delete the explicit entry. This keeps the table small and makes role changes propagate correctly.

### Build Order Implication

Permission matrix is **independent** of other new features. It depends only on the existing auth/permission infrastructure. Can be built in parallel with anything.

---

## Capability 4: PDF Generation

### Architecture Decision: Server-Side vs Client-Side

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Puppeteer (server-side)** | Renders actual React charts, pixel-perfect, handles CSS, works for all views | Heavy dependency (~300MB Chrome), memory-intensive, Windows compatibility concerns | **Recommended** |
| **jsPDF + html2canvas (client-side)** | No server dependency, lighter | Poor chart rendering (canvas rasterisation), layout issues, no real page control | Not recommended for chart-heavy dashboards |
| **React-pdf (@react-pdf/renderer)** | Pure React, no browser dependency | Cannot render Recharts (SVG incompatible), must rebuild all charts as react-pdf primitives | Too much rework |
| **Hybrid: server generates data, client renders PDF** | Separation of concerns | Still has chart rendering problem | Does not solve the core issue |

**Recommendation: Use Puppeteer on the server** because:
1. The dashboard has Recharts SVG charts that must appear in the PDF
2. Puppeteer renders the actual React page, so PDF matches what users see
3. The server runs on a Windows 11 machine with plenty of resources
4. This is a low-frequency operation (weekly PDF exports, not high-throughput)

**Confidence: MEDIUM** -- Puppeteer is well-established for PDF generation, but cannot verify current version or Windows-specific issues via web.

### Where It Fits

```
server/src/
  services/PdfService.ts       # Puppeteer browser pool, PDF generation
  routes/exports.ts            # GET /api/v1/exports/pdf/:page?weekEnding=...
                               # GET /api/v1/exports/csv/:page?weekEnding=...

client/src/
  components/ui/ExportButtons.tsx  # UPDATE existing stub to call real endpoints
```

### Data Flow

```
User clicks "PDF" button on Executive Summary
    |
    v
Client sends GET /api/v1/exports/pdf/executive-summary?weekEnding=2025-01-25
    |
    v
Server PdfService:
  1. Launch headless Chromium (or reuse pooled instance)
  2. Navigate to http://localhost:6000/executive-summary?weekEnding=2025-01-25&print=true
     (The &print=true query param triggers a print-optimised layout)
  3. Wait for all charts to render (waitForSelector or waitForNetworkIdle)
  4. Inject branding header (from SettingsService.get('branding'))
  5. Call page.pdf({ format: 'A4', landscape: true, printBackground: true })
  6. Return PDF buffer as response with Content-Type: application/pdf
    |
    v
Client receives PDF blob, triggers download
```

### Print-Optimised Layout Pattern

Add a `?print=true` query parameter that the React app detects:

```typescript
// In App.tsx or a dedicated PrintLayout wrapper
const isPrint = new URLSearchParams(window.location.search).get('print') === 'true';

if (isPrint) {
  return (
    <div className="print-layout">
      {/* No sidebar, no top bar, just the page content */}
      {/* Branding header injected */}
      <PrintHeader /> {/* Logo, company name, page title, week, timestamp */}
      <ExecutiveSummary />
    </div>
  );
}
```

### Browser Pool Pattern

Do not launch a new browser for every PDF. Use a singleton or small pool:

```typescript
export class PdfService {
  private static browser: Browser | null = null;

  private static async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  static async generatePdf(pageUrl: string, options?: PDFOptions): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      return await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
        ...options,
      });
    } finally {
      await page.close();
    }
  }
}
```

### Integration with Existing Code

- **ExportButtons.tsx:** Replace `alert('PDF export coming soon')` with actual fetch call to `/api/v1/exports/pdf/:page`
- **Branding dependency:** PdfService reads branding from SettingsService (logo, company name for header)
- **Auth in print mode:** The Puppeteer browser needs to access the dashboard. In dev mode, no token needed. In production, either:
  - Generate a short-lived print token that the URL includes
  - Or have Puppeteer navigate to the server-rendered page directly (not the client SPA)

### Build Order Implication

PDF generation depends on:
1. Admin settings (branding) -- should be built first
2. Dashboard views (already exist) -- no blocker
3. Does NOT depend on Xero or Excel migration

---

## Capability 5: Xero OAuth2 Integration

### Where It Fits

```
server/src/
  services/XeroService.ts       # OAuth2 flow, token management, data sync
  services/XeroSyncService.ts   # Data transformation: Xero API -> Prisma schema
  routes/xero.ts                # OAuth endpoints + manual sync trigger
  jobs/
    xero-sync.ts                # Scheduled sync job (cron)

server/.env
  XERO_CLIENT_ID=
  XERO_CLIENT_SECRET=
  XERO_REDIRECT_URI=http://localhost:6001/api/v1/xero/callback
```

### OAuth2 Token Flow

```
Admin clicks "Connect to Xero" in Admin Settings
    |
    v
GET /api/v1/xero/authorize
  -> Redirect to https://login.xero.com/identity/connect/authorize
  -> Scopes: openid profile email accounting.transactions.read
             accounting.reports.read accounting.settings.read offline_access
    |
    v
User authorises in Xero
    |
    v
Xero redirects to /api/v1/xero/callback?code=...
    |
    v
Server exchanges code for tokens:
  - access_token (30 min expiry)
  - refresh_token (60 day expiry if unused)
  - id_token (user info)
  - tenant connections (org IDs)
    |
    v
Store tokens encrypted in database (settings table or dedicated table)
Update settings: xero_connection.status = 'connected'
    |
    v
Redirect admin back to Admin Settings with success message
```

### Token Storage Pattern

**Two options:**

| Option | Approach | Recommendation |
|--------|----------|----------------|
| **Settings table** | Store as `settings.xero_tokens` JSON | Simple, but tokens are sensitive |
| **Dedicated table** | `xero_tokens` with encrypted columns | More secure, proper lifecycle |

**Recommendation: Dedicated table** because:
- Tokens are security-sensitive (access to financial data)
- Need separate access_token and refresh_token with individual expiry tracking
- Encryption at rest is important

```prisma
model XeroToken {
  id              Int      @id @default(autoincrement())
  tenantId        String   @unique @map("tenant_id")
  tenantName      String   @map("tenant_name")
  accessToken     String   @map("access_token")     // encrypt at application layer
  refreshToken    String   @map("refresh_token")     // encrypt at application layer
  accessExpiry    DateTime @map("access_expiry")
  refreshExpiry   DateTime @map("refresh_expiry")
  scopes          String
  connectedBy     String?  @map("connected_by")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  @@map("xero_tokens")
}
```

### Token Refresh Logic

```
Before any Xero API call:
    |
    v
Is access_token expired (or within 5 min of expiry)?
    |
    +--> NO: Use existing access_token
    |
    +--> YES: Is refresh_token still valid (< 60 days)?
              |
              +--> YES: POST /token with grant_type=refresh_token
              |         Update both tokens in database
              |         Continue with new access_token
              |
              +--> NO: Set xero_connection.status = 'disconnected'
                       Show "Reconnect to Xero" prompt in admin
                       Log warning
```

### Sync Service Architecture

```typescript
export class XeroSyncService {
  // Maps Xero P&L report to financial_weekly records
  static async syncProfitAndLoss(from: Date, to: Date): Promise<SyncResult> {
    const xeroData = await XeroService.getProfitAndLossReport(from, to);
    // Transform Xero report rows to financial_weekly schema
    // Upsert with dataSource: 'xero_api'
  }

  // Maps Xero invoices to revenue_weekly + projects_weekly
  static async syncInvoices(from: Date, to: Date): Promise<SyncResult> {
    const invoices = await XeroService.getInvoices(from, to);
    // Group by week (snap to Saturday)
    // Categorise by account code mapping
    // Upsert into revenue_weekly and projects_weekly
  }

  // Maps Xero bank summary to cash_position_weekly
  static async syncBankSummary(): Promise<SyncResult> {
    const accounts = await XeroService.getBankSummary();
    // Map account names to cash_position fields
  }
}
```

### Scheduling

For a Windows 11 local server, use `node-cron` (in-process cron) rather than system-level Task Scheduler:

```typescript
// server/src/jobs/xero-sync.ts
import cron from 'node-cron';
import { XeroSyncService } from '../services/XeroSyncService.js';

// Run daily at 6:00 AM AEST (20:00 UTC previous day)
cron.schedule('0 20 * * *', async () => {
  try {
    await XeroSyncService.syncAll();
  } catch (err) {
    console.error('Xero sync failed:', err);
    // Update settings: xero_connection.status based on error type
  }
});
```

**Import the job file in `server/src/index.ts`** so it starts when the server starts.

### Library Recommendation

**Use `xero-node` SDK** because:
- Official Xero SDK for Node.js
- Handles OAuth2 token exchange and refresh
- Provides typed interfaces for all Xero API endpoints
- Maintained by Xero

**Confidence: MEDIUM** -- `xero-node` is the official SDK (training data). Cannot verify current version or breaking changes via web. The `.env.example` already scaffolds `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET`, confirming Xero integration was always planned.

**Additional dependency: `node-cron`** for in-process job scheduling. Lightweight, no external scheduler needed.

### Rate Limiting

Xero limits: 60 calls/minute, 5,000/day. For a weekly sync of one small organisation, this is not a concern. However, implement a simple rate limiter:

```typescript
class XeroRateLimiter {
  private callTimestamps: number[] = [];

  async throttle(): Promise<void> {
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter(t => now - t < 60000);
    if (this.callTimestamps.length >= 58) { // Leave 2 call buffer
      const waitMs = 60000 - (now - this.callTimestamps[0]);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    this.callTimestamps.push(Date.now());
  }
}
```

### Build Order Implication

Xero integration depends on:
1. Admin settings (connection status display, sync status) -- build settings first
2. New Prisma migration (XeroToken table)
3. Does NOT depend on PDF, Excel migration, or permissions

---

## Capability 6: Export Service (CSV + PDF)

### Where It Fits

Exports are a **cross-cutting service** used by all dashboard views. Both CSV and PDF share a route file.

```
server/src/
  routes/exports.ts             # All export endpoints
  services/CsvExportService.ts  # Data -> CSV conversion
  services/PdfService.ts        # Puppeteer PDF generation (see Capability 4)

client/src/
  components/ui/ExportButtons.tsx  # UPDATE existing component
```

### CSV Export Architecture

CSV export is simpler than PDF. The server already has all the data; just format it.

**Pattern: Data endpoint + CSV formatter**

```typescript
// GET /api/v1/exports/csv/executive-summary?weekEnding=2025-01-25
// Returns: text/csv with Content-Disposition: attachment

router.get('/csv/:page', async (req, res) => {
  const { page } = req.params;
  const { weekEnding } = req.query;

  // Reuse existing data-fetching logic from dashboard routes
  const data = await getPageData(page, weekEnding);

  // Transform to CSV using papaparse (already installed!)
  const csv = Papa.unparse(data.rows, { header: true });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${page}_${weekEnding}.csv"`);
  res.send(csv);
});
```

**Key insight:** `papaparse` is already installed (`server/package.json` line 19). It supports `unparse()` for CSV generation, not just parsing. No new dependency needed for CSV export.

### Export Endpoint Structure

```
GET /api/v1/exports/csv/:page?weekEnding=YYYY-MM-DD
GET /api/v1/exports/pdf/:page?weekEnding=YYYY-MM-DD

Pages: executive-summary, financial, regional-performance
```

### Frontend Integration

Update `ExportButtons.tsx` to accept page context and trigger downloads:

```typescript
interface ExportButtonsProps {
  page: string;       // e.g. 'executive-summary'
  weekEnding: string; // ISO date from WeekContext
  disabled?: boolean;
}

function handleCsvExport() {
  window.open(`/api/v1/exports/csv/${page}?weekEnding=${weekEnding}`);
}

function handlePdfExport() {
  // Show loading indicator, fetch as blob, trigger download
  fetch(`/api/v1/exports/pdf/${page}?weekEnding=${weekEnding}`)
    .then(res => res.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${page}_${weekEnding}.pdf`;
      a.click();
    });
}
```

### Build Order Implication

- CSV export can be built immediately (uses existing papaparse, existing data routes)
- PDF export depends on Puppeteer setup and branding settings
- Both are consumed by all dashboard pages (already have ExportButtons stubs)

---

## Recommended New File/Directory Structure

All new files needed, organized by where they fit in the existing structure:

```
server/
  prisma/
    schema.prisma                    # ADD: XeroToken model
    migrations/                      # New migration for XeroToken

  scripts/                           # NEW directory
    migrate-excel.ts                 # Excel migration orchestrator
    excel-readers/                   # Per-sheet readers
      weekly-report.ts
      finance-this-week.ts
      sales-weekly.ts
      marketing-weekly.ts
      operations-weekly.ts
      phone.ts
    excel-utils.ts                   # Shared transpose/parse utilities

  src/
    routes/
      settings.ts                    # NEW: Admin settings CRUD
      users.ts                       # NEW: User management + permission matrix
      xero.ts                        # NEW: Xero OAuth + sync triggers
      exports.ts                     # NEW: CSV + PDF export endpoints

    services/
      SettingsService.ts             # NEW: Typed settings access with defaults
      PdfService.ts                  # NEW: Puppeteer PDF generation
      CsvExportService.ts            # NEW: Data -> CSV formatting
      XeroService.ts                 # NEW: Xero OAuth2 + API calls
      XeroSyncService.ts             # NEW: Xero data -> Prisma transformation

    jobs/                            # NEW directory
      xero-sync.ts                   # Scheduled Xero sync (node-cron)

    index.ts                         # UPDATE: Register new routes + job imports

client/src/
  lib/
    settingsApi.ts                   # NEW: Settings API wrapper
    userApi.ts                       # NEW: User management API wrapper
    exportApi.ts                     # NEW: Export trigger functions

  components/
    admin/
      AdminSettings.tsx              # NEW: Admin settings page (replaces placeholder)
      BrandingSection.tsx            # NEW: Logo + colour config
      PassthroughConfig.tsx          # NEW: Pass-through items editor
      AlertThresholds.tsx            # NEW: Threshold config
      SystemStatus.tsx               # NEW: Xero/3CX connection cards
      UserManagement.tsx             # NEW: User list + role assignment
      UserEditModal.tsx              # NEW: Edit single user
      PermissionMatrix.tsx           # NEW: Grid view users x pages

    ui/
      ExportButtons.tsx              # UPDATE: Wire to real export endpoints
      PrintHeader.tsx                # NEW: Branding header for PDF print mode

  App.tsx                            # UPDATE: Replace admin/user placeholders with real components
```

---

## Build Order (Dependency-Driven)

Based on the integration analysis, here is the recommended build sequence:

```
Phase A: Foundation (no dependencies on other new features)
  1. Admin Settings backend + UI    <-- Other features need branding/config
  2. Excel Migration Scripts         <-- Independent, data population
  3. Permission Matrix UI            <-- Independent, completes user management

Phase B: Depends on Phase A
  4. CSV Export Service              <-- Needs existing data routes only
  5. PDF Generation (Puppeteer)      <-- Needs branding from admin settings

Phase C: Depends on Phase A (can parallel with Phase B)
  6. Xero OAuth2 Integration         <-- Needs admin settings for status display
  7. Xero Sync Service + Scheduling  <-- Needs Xero OAuth
```

**Rationale:**
- Admin settings first because PDF export needs branding and financial views need pass-through config
- Excel migration can run in parallel -- it is a standalone script
- Permission matrix is pure CRUD UI with no downstream dependencies
- CSV export is simple (papaparse already installed) and can ship quickly
- PDF is more complex (Puppeteer setup, print layout) but has clear implementation path
- Xero is the most complex and has external credential dependencies (pending from 180D)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Export Route

**What people do:** Put all CSV formatting, PDF generation, data fetching, and branding injection into a single route handler
**Why it is wrong:** Becomes unmaintainable, untestable, and difficult to extend to new pages
**Do this instead:** Separate concerns: route handles HTTP, CsvExportService handles formatting, PdfService handles rendering, SettingsService provides branding. Each page's data is fetched by reusing existing service methods.

### Anti-Pattern 2: Storing Xero Tokens in Settings Table

**What people do:** Store OAuth tokens as a JSON blob in the generic settings table
**Why it is wrong:** Tokens are security-sensitive credentials with lifecycle semantics (expiry, refresh). Settings table has no encryption, no expiry tracking, and mixes config with secrets.
**Do this instead:** Use a dedicated `xero_tokens` table with application-layer encryption. Keep settings for non-sensitive config only.

### Anti-Pattern 3: Running Excel Migration Through the CSV Upload Pipeline

**What people do:** Try to reuse the CSV upload wizard for Excel data, converting Excel to CSV first
**Why it is wrong:** The Excel data is transposed (weeks as columns), has multiple data sections per sheet, and contains formula errors (#REF!, #DIV/0!). The CSV pipeline expects row-per-record format.
**Do this instead:** Write dedicated migration scripts that understand the Excel layout. Reuse only the low-level utilities (date snapping, currency parsing) from existing services.

### Anti-Pattern 4: Client-Side PDF Generation for Chart-Heavy Pages

**What people do:** Use jsPDF + html2canvas to capture the current page as a PDF from the browser
**Why it is wrong:** html2canvas renders SVG charts poorly (Recharts uses SVG), produces blurry output, cannot handle multi-page layouts, and varies by browser.
**Do this instead:** Use server-side Puppeteer which renders the actual React app in headless Chrome, producing pixel-perfect PDF output matching what users see on screen.

### Anti-Pattern 5: Polling Xero Connection Status

**What people do:** Have the frontend poll `/api/v1/xero/status` every few seconds to update connection status
**Why it is wrong:** Wasteful for a status that changes maybe once a day
**Do this instead:** Fetch status on admin page load only. Update status as a side effect of sync operations. The sync job updates the settings record when it runs.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (1-5 users, single org) | Everything works as designed. Single Puppeteer instance, in-process cron, settings in DB. |
| 10-20 users | Consider caching settings in memory (they change rarely). Add rate limiting on export endpoints to prevent concurrent PDF generation. |
| Multiple organisations | Not in scope. Would require tenant-scoped settings, per-org Xero tokens, separate database schemas. |

### First bottleneck: Puppeteer memory

PDF generation launches headless Chrome. If multiple users request PDFs simultaneously, memory spikes. **Mitigation:** Queue PDF requests and process one at a time. For this user base (4-5 people), this is unlikely to be an issue.

### Second bottleneck: Xero rate limits

60 calls/minute. If sync logic makes too many API calls during a single sync run, it could hit limits. **Mitigation:** Batch date ranges into larger queries (monthly P&L reports instead of weekly). Implement the rate limiter described above.

---

## Sources

- Existing codebase analysis: `server/src/index.ts`, `server/src/routes/*.ts`, `server/src/services/*.ts`, `server/prisma/schema.prisma`, `client/src/App.tsx`, `client/src/components/ui/ExportButtons.tsx` -- **HIGH confidence**
- Task sequence document: `Buildable_Dashboard_Phase1_Task_Sequence.md` Tasks 13-17 -- **HIGH confidence** (specifies what to build)
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/INTEGRATIONS.md` -- **HIGH confidence** (documents current state)
- Library recommendations (exceljs, puppeteer, xero-node, node-cron): Based on training data -- **MEDIUM confidence** (web verification unavailable, versions may have changed)
- `.env.example`: Confirms Xero and 3CX env vars were pre-planned -- **HIGH confidence**

---
*Architecture research for: Buildable Dashboard remaining features*
*Researched: 2026-02-06*
