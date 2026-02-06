# Stack Research

**Domain:** Business dashboard -- Excel migration, PDF/CSV export, Xero API integration
**Researched:** 2026-02-06
**Confidence:** MEDIUM (training data only -- WebSearch/WebFetch/npm unavailable for version verification)

## Context

This is a **subsequent milestone** research, not a greenfield project. The core stack is already chosen and working:
- Frontend: React 19.2.0 + Vite 7.2.4 + Tailwind CSS 4.1.18 + Recharts 3.7.0
- Backend: Express 4.21.2 + TypeScript 5.7-5.9 + Prisma 6.3.0 + PostgreSQL
- Existing: CSV upload/parsing (PapaParse 5.5.2), file handling (Multer), auth (MSAL + JWT)

This research covers **new libraries needed** for remaining features only.

---

## Recommended Stack Additions

### 1. Excel File Parsing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **ExcelJS** | ^4.4 | Read .xlsx files with complex layouts (merged cells, formulas, transposed data) | Best Node.js option for reading complex workbooks. Handles merged cells, formula cached values, cell styles, and streaming reads. MIT licensed, actively maintained. TypeScript definitions included. |

**Confidence:** MEDIUM -- ExcelJS 4.x is well-established in training data. Exact latest minor version should be verified at install time with `npm view exceljs version`.

**Why ExcelJS over SheetJS (xlsx)?**

| Criterion | ExcelJS | SheetJS (xlsx) |
|-----------|---------|----------------|
| License | MIT (fully open) | Apache 2.0 for community edition, but "Pro" features (some write modes, advanced parsing) require paid license |
| Merged cell handling | Full support -- reads merged cell ranges and values | Supported but behaviour with complex merges can be inconsistent |
| Formula values | Reads cached formula results (the computed value stored by Excel) | Reads formula text and cached values |
| Streaming | Supports streaming reads for large files | Supports streaming |
| TypeScript | Built-in types | Types via @types/xlsx, sometimes lag |
| API style | Object-oriented (Workbook, Worksheet, Row, Cell) -- intuitive for complex traversal | Utility-function style (read, utils) -- concise but less ergonomic for cell-by-cell work |
| Transposed layouts | Easy to iterate by row then column, or column then row | Requires manual coordinate math |

**Decision: Use ExcelJS** because the Weekly Report workbook has transposed layouts (weeks as columns, metrics as rows), merged cells in headers, and formula values that need to be read as their computed results. ExcelJS's object model makes cell-by-cell traversal with coordinate-based access (e.g., `worksheet.getCell('C5')`) straightforward.

**Critical for this project:** The migration script needs to read 12 sheets with complex, non-tabular layouts. This is NOT a simple "read table from Excel" task. The "Weekly Report" sheet has metrics as rows and weeks as columns, with merged header cells and formula-computed values. ExcelJS's `worksheet.getRow()` and `worksheet.getColumn()` methods handle this well.

**Key API patterns for migration:**
```typescript
import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile('Weekly_Report__30.xlsx');

const sheet = workbook.getWorksheet('Weekly Report');
// Read transposed data: iterate columns (weeks) for a given row (metric)
const row = sheet.getRow(5); // e.g., week ending dates row
row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
  // cell.value gives the computed value (for formulas, the cached result)
  // cell.type indicates CellType (Number, String, Date, Formula, etc.)
});

// Handle merged cells
const mergedRanges = sheet.model.merges; // array of 'A1:C1' style ranges
```

---

### 2. PDF Generation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Puppeteer** | ^23 or ^24 | Server-side PDF generation from dashboard HTML/CSS | Renders actual dashboard views (including Recharts SVG charts) to pixel-perfect branded PDFs. Uses headless Chromium. |

**Confidence:** MEDIUM -- Puppeteer is mature and well-known. The approach (render HTML to PDF) is the standard pattern for dashboard export. Exact version should be verified.

**Why Puppeteer for this project?**

The requirement is to generate "a formatted PDF snapshot of the current view" including charts (Recharts SVGs), tables, KPI cards, and Buildable branding. This is fundamentally a **"screenshot the page as PDF"** problem, not a **"generate a PDF from data"** problem.

| Approach | Library | Verdict for This Project |
|----------|---------|--------------------------|
| **Headless browser PDF** | Puppeteer | **RECOMMENDED.** Renders real HTML/CSS/SVG (Recharts charts) to PDF. What-you-see-is-what-you-get. Handles complex layouts automatically. |
| Programmatic PDF | PDFKit | NOT recommended. Would require manually recreating every chart, table, and KPI card layout in PDFKit's API. Enormous effort, fragile, and charts would need to be redrawn from data (Recharts cannot render into PDFKit). |
| React-to-PDF | @react-pdf/renderer | NOT recommended. Uses its own layout engine (not browser CSS). Would require rewriting every dashboard component in react-pdf primitives. Does not render Recharts. |
| Client-side capture | html2canvas + jsPDF | AVOID for this project. Runs in browser (blocks UI), produces raster images (blurry at zoom), cannot access server-side data efficiently, unreliable with SVG charts. |

**Architecture for Puppeteer PDF export:**

The approach is server-side rendering:
1. Backend receives `GET /api/v1/export/pdf?page=executive-summary&weekEnding=2025-01-25`
2. Backend launches Puppeteer, navigates to a **dedicated export URL** (e.g., `http://localhost:6000/export/executive-summary?weekEnding=2025-01-25`)
3. The export route renders the same React components but with print-friendly styling (no sidebar, no navigation, branded header/footer)
4. Puppeteer calls `page.pdf()` to generate the PDF
5. Backend streams the PDF back to the client

**Key considerations:**
- **Chromium download:** Puppeteer bundles Chromium (~300MB). On Windows 11 local server, this is fine. Use `puppeteer` (not `puppeteer-core`) for automatic Chromium management.
- **Performance:** First PDF takes 2-3 seconds (Chromium cold start). Subsequent PDFs in same session are faster. Consider keeping a browser instance alive.
- **Memory:** Chromium uses ~100-200MB RAM per instance. For a small user base (4-5 directors), this is negligible.
- **Print CSS:** Create `@media print` styles or a dedicated `/export/` route with print-optimised layout.

**Key API pattern:**
```typescript
import puppeteer from 'puppeteer';

async function generatePdf(pageUrl: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(pageUrl, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'A4',
    landscape: true, // for wide tables
    printBackground: true, // include background colours
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  });
  await browser.close();
  return Buffer.from(pdf);
}
```

---

### 3. CSV Export

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **PapaParse** (already installed) | 5.5.2 | Generate CSV strings from data arrays | Already in the project for CSV parsing. PapaParse.unparse() generates CSV from arrays/objects. Zero new dependencies. |

**Confidence:** HIGH -- PapaParse is already installed and its `unparse()` function is well-documented.

**Why no new library needed:**

PapaParse, already installed at 5.5.2 for CSV import/parsing, has a built-in `Papa.unparse()` function that generates CSV strings from JavaScript arrays or objects. There is no reason to add another library.

**Implementation pattern:**
```typescript
import Papa from 'papaparse';

function generateCsv(data: Record<string, unknown>[], columns: string[]): string {
  return Papa.unparse({
    fields: columns,
    data: data.map(row => columns.map(col => row[col])),
  });
}

// Express route
app.get('/api/v1/export/csv', async (req, res) => {
  const { dataType, weekEnding } = req.query;
  const data = await fetchDataForExport(dataType, weekEnding);
  const csv = generateCsv(data, Object.keys(data[0]));

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${dataType}-${weekEnding}.csv"`);
  res.send(csv);
});
```

**Formatting considerations for this project:**
- Dates should be DD/MM/YYYY (Australian format) in exported CSVs
- Currency values should include `$` prefix and comma separators
- Use UTF-8 BOM (`\uFEFF` prefix) so Excel opens the file correctly with special characters

---

### 4. Xero API Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **xero-node** | ^5 or ^6 | Official Xero SDK for Node.js -- OAuth2 flow, API consumption, token management | Official SDK maintained by Xero. Handles OAuth2 PKCE/authorization code flow, token refresh, and provides typed methods for all Xero API endpoints. |

**Confidence:** MEDIUM -- xero-node is the official SDK. Major version should be verified at install time. The OAuth2 flow and API patterns are well-established.

**Why xero-node (not raw HTTP)?**

| Criterion | xero-node SDK | Raw HTTP (axios/fetch) |
|-----------|---------------|------------------------|
| OAuth2 handling | Built-in token management, refresh, and PKCE support | Manual implementation of OAuth2 flow, token storage, refresh logic |
| API typing | TypeScript types for all Xero API responses (Invoices, Reports, Accounts) | Manual type definitions |
| Rate limiting | SDK respects rate limits and provides retry headers | Manual implementation |
| API versioning | SDK tracks Xero API versions | Manual URL management |
| Maintenance | Updated when Xero changes APIs | Must track API changes manually |

**Decision: Use xero-node** because it is the official, maintained SDK with TypeScript support and handles the complex OAuth2 token lifecycle (access tokens expire every 30 minutes, refresh tokens expire after 60 days of inactivity).

**Xero OAuth2 Architecture:**

```
User clicks "Connect to Xero" in Admin Settings
  -> Backend generates authorization URL via xero-node
  -> User authorised in Xero (browser redirect)
  -> Xero redirects to /api/v1/xero/callback with auth code
  -> Backend exchanges code for access + refresh tokens
  -> Tokens stored encrypted in database (xero_connections table)
  -> Access token auto-refreshed on each API call (30-min expiry)
  -> Refresh token valid for 60 days of inactivity
  -> If refresh token expires: show "Reconnect" prompt in admin
```

**Key Xero API endpoints for this project:**

| Xero Endpoint | Dashboard Table | Notes |
|---------------|----------------|-------|
| `GET /Reports/ProfitAndLoss` | `financial_weekly` | P&L summary by date range |
| `GET /Invoices` | `revenue_weekly`, `projects_weekly` | Filter by date, aggregate by category |
| `GET /Reports/BankSummary` | `cash_position_weekly` | Bank balances |
| `GET /Accounts` | Reference data | Chart of accounts for category mapping |
| `GET /Reports/AgedReceivablesByContact` | Cash position display | Aged receivables breakdown |

**Rate limiting:** Xero allows 60 API calls per minute and 5,000 per day. For weekly batch syncs, this is more than sufficient. Implement a simple queue with delay between calls.

**Token encryption:** Store tokens encrypted at rest in PostgreSQL. Use Node.js `crypto` module with AES-256-GCM. Key from environment variable (`XERO_ENCRYPTION_KEY`).

**Mock mode:** For development without live Xero credentials, create a mock adapter that returns sample data matching the Excel workbook figures. Toggle via `XERO_MOCK_MODE=true` environment variable.

---

### 5. Admin/Settings UI Patterns

No new libraries required. The existing stack handles this:

| Need | Solution | Already Available |
|------|----------|-------------------|
| Form inputs | Tailwind CSS styled `<input>`, `<select>`, `<textarea>` | Yes (existing pattern in Target Management) |
| Toggle switches | Tailwind CSS toggle component | Yes (used in existing views) |
| Permission matrix grid | Custom React component with checkbox grid | Build with existing React + Tailwind |
| Settings persistence | Express API + Prisma `settings` table (JSON column) | Standard pattern, no new library |
| Colour pickers | HTML5 `<input type="color">` | Browser native, no library needed |
| File upload (logo) | Multer (already installed) | Yes |

**Decision:** Do NOT add a form library (React Hook Form, Formik, etc.) for the admin settings page. The forms are simple (a few text inputs, toggles, colour pickers) and the project does not use a form library elsewhere. Adding one for a single page creates inconsistency. Use controlled React state as per existing patterns.

---

## Supporting Libraries (Already Installed, No Changes)

| Library | Version | Role in New Features |
|---------|---------|---------------------|
| papaparse | 5.5.2 | CSV export via `Papa.unparse()` |
| multer | 1.4.5-lts.1 | Logo upload in admin settings |
| zod | 3.24.1 | Validation of export/Xero API request params |
| @prisma/client | 6.3.0 | Xero token storage, settings table, new queries |

---

## Installation

```bash
# Server-side additions (run from project root)
npm install -w server exceljs puppeteer xero-node

# Type definitions (ExcelJS includes its own types; Puppeteer includes its own types)
# xero-node includes its own TypeScript types
# No additional @types packages needed
```

**Post-install notes:**
- Puppeteer will download Chromium (~300MB) on first install. This is expected.
- On Windows 11, Puppeteer's bundled Chromium works out of the box. No additional system dependencies needed.
- ExcelJS and xero-node are pure JavaScript/TypeScript -- no native dependencies.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| ExcelJS | SheetJS (xlsx) community edition | If you only need simple tabular reads (no merged cells, no cell-by-cell traversal). SheetJS is faster for simple cases but its community edition has limitations and the licensing model has shifted toward paid "Pro" features. |
| ExcelJS | xlsx-populate | If ExcelJS has issues with a specific Excel feature. xlsx-populate is a less popular but capable alternative. However, it is less actively maintained. |
| Puppeteer | Playwright | If you need cross-browser PDF generation or already use Playwright for testing. Playwright is Microsoft's Puppeteer alternative with similar API. Either works; Puppeteer is more commonly used for PDF generation specifically. |
| Puppeteer | PDFKit | If generating data-only reports without charts (e.g., a simple table export). PDFKit is lighter but cannot render React/SVG components. |
| PapaParse (unparse) | csv-stringify | If you need streaming CSV generation for very large datasets (100K+ rows). For dashboard exports (hundreds of rows at most), PapaParse is sufficient and already installed. |
| xero-node | Raw axios + manual OAuth2 | If Xero changes their SDK in a breaking way or drops support. Unlikely for the official SDK. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **jsPDF + html2canvas** (client-side PDF) | Runs in browser (blocks UI for seconds), produces raster images (blurry), unreliable with SVG charts, cannot access server-side auth context | Puppeteer (server-side) |
| **SheetJS Pro** (paid xlsx) | Licensing cost for features available free in ExcelJS. The community "xlsx" npm package has had licensing confusion historically. | ExcelJS (MIT, fully open) |
| **React Hook Form / Formik** (for admin settings) | Adds dependency for 1-2 simple forms when the rest of the codebase uses controlled state. Creates inconsistency. | Controlled React state (existing pattern) |
| **@react-pdf/renderer** (for PDF export) | Requires rewriting components in react-pdf primitives. Cannot render Recharts. Completely different layout engine. | Puppeteer rendering actual dashboard HTML |
| **node-xlsx** | Thin wrapper around SheetJS with fewer features. No advantage over ExcelJS. | ExcelJS |
| **csv-writer / csv-generate** | Adds unnecessary dependency when PapaParse already installed and has unparse() | PapaParse.unparse() |
| **Custom OAuth2 implementation** (for Xero) | OAuth2 with PKCE, token refresh, and Xero-specific quirks is complex. The official SDK handles edge cases (token rotation, tenant selection). | xero-node official SDK |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| exceljs | Node.js 14+ | Pure JS, works with any modern Node version. No native dependencies. |
| puppeteer | Node.js 18+ | Requires Node 18+ for recent versions. Project already targets ES2022, so Node 18+ is assumed. |
| xero-node | Node.js 14+ | Check minimum Node version in package.json at install time. |
| All new packages | TypeScript 5.x | All include TypeScript definitions. Compatible with project's TS 5.7-5.9 range. |
| puppeteer | Windows 11 | Puppeteer bundles its own Chromium. Works on Windows without system-level Chrome install. |

---

## Stack Patterns by Feature

**If building Excel migration scripts (Task 13):**
- Use ExcelJS `workbook.xlsx.readFile()` for the .xlsx workbook
- Iterate sheets individually, handle each sheet's unique layout
- Read cell values (not formulas) -- ExcelJS returns the cached computed value
- Handle `#REF!` and `#DIV/0!` errors by checking `cell.type === ExcelJS.ValueType.Error`
- Write migration as a standalone TypeScript script (`server/src/scripts/migrate-excel.ts`)
- Run via `npx tsx server/src/scripts/migrate-excel.ts`

**If building PDF export (Task 16):**
- Keep a singleton Puppeteer browser instance (avoid cold-start per request)
- Create dedicated `/export/` routes in the React app with print-optimised layouts
- Use `page.pdf({ format: 'A4', landscape: true })` for dashboard views
- Add branded header (Buildable logo, page title) and footer (date, page number) via Puppeteer's `headerTemplate`/`footerTemplate`
- Timeout: set navigation timeout to 30 seconds (charts may take time to render with data)

**If building Xero integration (Task 17):**
- Create `server/src/services/XeroService.ts` following existing service pattern
- Store OAuth tokens in a `xero_connections` table (Prisma model)
- Implement token refresh as middleware that runs before each Xero API call
- Create mock adapter for development: `XeroMockService` that returns fixture data
- Use environment variable to toggle: `XERO_MOCK_MODE=true`

**If building CSV export (Task 16):**
- Add export endpoints to existing route files (e.g., `GET /api/v1/financial/export/csv`)
- Use PapaParse `unparse()` on the server side
- Format dates as DD/MM/YYYY, currency with `$` and commas
- Prepend UTF-8 BOM for Excel compatibility

---

## New Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `XERO_CLIENT_ID` | Xero OAuth2 app client ID | (already in .env.example) |
| `XERO_CLIENT_SECRET` | Xero OAuth2 app client secret | (already in .env.example) |
| `XERO_REDIRECT_URI` | Xero OAuth2 callback URL | `http://localhost:6001/api/v1/xero/callback` (already in .env.example) |
| `XERO_ENCRYPTION_KEY` | AES-256 key for token encryption at rest | (new, required for production) |
| `XERO_MOCK_MODE` | Use mock Xero data instead of live API | `true` in development |
| `PUPPETEER_EXECUTABLE_PATH` | Override Chromium path if needed | (optional, Puppeteer manages its own) |

---

## New Prisma Models Needed

```prisma
model XeroConnection {
  id                String   @id @default(cuid())
  tenantId          String   @unique @map("tenant_id")
  tenantName        String   @map("tenant_name")
  accessToken       String   @map("access_token")   // encrypted
  refreshToken      String   @map("refresh_token")   // encrypted
  tokenExpiresAt    DateTime @map("token_expires_at")
  connectedBy       String   @map("connected_by")
  connectedAt       DateTime @map("connected_at")
  lastSyncAt        DateTime? @map("last_sync_at")
  lastSyncStatus    String?  @map("last_sync_status") // success, failed, partial
  lastSyncMessage   String?  @map("last_sync_message")
  isActive          Boolean  @default(true) @map("is_active")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@map("xero_connections")
}

model Setting {
  id        String   @id @default(cuid())
  key       String   @unique
  value     Json     // flexible JSON storage for various settings
  updatedBy String?  @map("updated_by")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("settings")
}
```

---

## Effort Estimates by Feature

| Feature | New Libraries | Complexity | Estimated Effort | Notes |
|---------|--------------|------------|-----------------|-------|
| Excel migration (Task 13) | ExcelJS | High | 2-3 days | Complex sheet layouts, 12 sheets, transposed data |
| PDF export (Task 16) | Puppeteer | Medium | 1-2 days | Main work is print-friendly CSS, Puppeteer API is straightforward |
| CSV export (Task 16) | None (PapaParse) | Low | 0.5 day | Simple `unparse()` calls per data endpoint |
| Xero OAuth2 scaffold (Task 17) | xero-node | High | 2-3 days | OAuth2 flow, token management, sync services, mock mode |
| Admin settings (Task 14) | None | Low-Medium | 1 day | Standard CRUD forms with existing patterns |
| User management (Task 15) | None | Medium | 1 day | Permission matrix grid is the complex part |

---

## Sources

- **ExcelJS:** Training data knowledge of ExcelJS 4.x API. MIT licensed, widely used for Node.js Excel operations. Confidence: MEDIUM (version not verified via npm, but library is mature and stable).
- **Puppeteer:** Training data knowledge of Puppeteer API for PDF generation. Google-maintained, de facto standard for headless Chrome automation. Confidence: MEDIUM (exact current version not verified).
- **PapaParse:** Already installed in project at 5.5.2. `unparse()` function verified in existing codebase context. Confidence: HIGH.
- **xero-node:** Training data knowledge of official Xero Node.js SDK. OAuth2 patterns well-established. Confidence: MEDIUM (exact version and current API surface not verified).
- **Existing project:** All existing stack details verified from `package.json` files and `.planning/codebase/` analysis docs. Confidence: HIGH.

**Verification notes:** WebSearch, WebFetch, and npm CLI were unavailable during this research session. All version recommendations use caret ranges (e.g., `^4.4`) to allow minor version flexibility. Before installing, run `npm view <package> version` to confirm the latest version and check for any security advisories.

---
*Stack research for: Buildable Dashboard -- remaining features*
*Researched: 2026-02-06*
