# Phase 3: Export & Xero Integration - Research

**Researched:** 2026-02-06
**Domain:** PDF/CSV export, Xero accounting API integration
**Confidence:** HIGH (exports), MEDIUM (Xero -- scaffolding only, no live credentials)

## Summary

Phase 3 covers two distinct domains: (1) CSV and PDF export of dashboard data, and (2) Xero accounting API integration scaffold. The CSV export is straightforward -- PapaParse (already installed) provides `Papa.unparse()` for client-side CSV generation with zero additional dependencies. PDF export requires a server-side approach using Puppeteer, which navigates to a print-optimised URL variant of each dashboard page and generates a PDF with Chromium's built-in PDF engine. The Xero integration uses the official `xero-node` SDK for OAuth2 flow, token management, and data sync, scaffolded in mock mode since live credentials are pending.

The existing codebase already has placeholder `ExportButtons` component (CSV + PDF buttons with `alert('coming soon')`) and a `SystemStatus` admin component showing Xero as "Not Connected". The architecture pattern is clear: enhance existing components rather than creating new pages.

**Primary recommendation:** Use client-side PapaParse for CSV, server-side Puppeteer for PDF generation via print-optimised routes, and xero-node SDK with mock mode toggle for Xero scaffolding.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| puppeteer | ^24.x | Server-side PDF generation via headless Chrome | Official Google-maintained, best HTML-to-PDF fidelity, full CSS/chart support via real browser engine |
| xero-node | latest | Xero API SDK (OAuth2, accounting, finance APIs) | Official Xero-maintained Node.js SDK, complete type definitions, covers all needed endpoints |
| node-cron | ^3.x | Cron-style job scheduling | Lightweight, pure JS, no binary deps, standard for Express scheduled tasks |
| papaparse | ^5.5.2 | CSV generation (unparse) | **Already installed** in server; use client-side for CSV download |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `crypto` (built-in) | N/A | AES-256-GCM encryption for Xero tokens | Encrypt access/refresh tokens before DB storage |
| file-saver (or native Blob) | N/A | Trigger browser file download | CSV download from client -- use native Blob + anchor, no extra dep needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Puppeteer | Playwright | Both Chromium-only for PDF; Puppeteer more mature for this use case, simpler API for PDF specifically |
| Puppeteer | PDFKit / jsPDF | Cannot render React components or Recharts; would require hand-building every table/chart programmatically |
| Puppeteer | @react-pdf/renderer | Cannot render Recharts SVGs or existing HTML tables; limited styling |
| node-cron | Bull/BullMQ | Overkill for single daily cron; Bull needs Redis |
| xero-node | Raw HTTP | SDK handles OAuth2 PKCE, token lifecycle, type safety; raw HTTP reimplements all of that |

**Installation:**
```bash
# Server
cd server && npm install puppeteer xero-node node-cron && npm install -D @types/node-cron
```

No client-side packages needed -- PapaParse is already available and CSV download uses native browser APIs (Blob + URL.createObjectURL + anchor click).

## Architecture Patterns

### Recommended Project Structure
```
server/src/
├── routes/
│   ├── exports.ts          # GET /api/v1/exports/csv/:page, /api/v1/exports/pdf/:page
│   └── xero.ts             # OAuth callback, sync endpoints, status
├── services/
│   ├── CsvExportService.ts  # Format data as CSV with AU date/currency
│   ├── PdfExportService.ts  # Launch Puppeteer, navigate, generate PDF
│   ├── XeroAuthService.ts   # OAuth2 flow, token encrypt/decrypt/refresh
│   ├── XeroSyncService.ts   # Pull P&L, invoices, bank summary
│   └── XeroScheduler.ts     # node-cron daily sync + manual trigger
├── middleware/
│   └── xeroRateLimit.ts     # Sliding window rate limiter for Xero calls

client/src/
├── components/ui/
│   └── ExportButtons.tsx    # Enhanced: real CSV + PDF handlers (already exists)
├── lib/
│   └── exportApi.ts         # API client for export + Xero endpoints
│   └── csvExport.ts         # Client-side CSV generation with Papa.unparse()
```

### Pattern 1: Client-Side CSV Export (Zero Server Round-Trip)
**What:** Generate CSV entirely in the browser from data already fetched for the dashboard page. No extra API call needed.
**When to use:** Every data table that has data already loaded on the client.
**Example:**
```typescript
// Source: Context7 /mholt/papaparse - Papa.unparse()
import Papa from 'papaparse';

interface ExportColumn {
  key: string;
  label: string;
  format?: (val: any) => string;
}

function exportToCsv(filename: string, columns: ExportColumn[], data: Record<string, any>[]) {
  const rows = data.map(row =>
    Object.fromEntries(
      columns.map(col => [
        col.label,
        col.format ? col.format(row[col.key]) : row[col.key] ?? ''
      ])
    )
  );

  const csv = Papa.unparse(rows, { header: true, newline: '\r\n' });

  // BOM for Excel to recognise UTF-8 with AUD symbols
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Pattern 2: Server-Side PDF via Puppeteer Print Route
**What:** Server launches headless Chromium, navigates to a print-optimised variant of the dashboard page, and uses `page.pdf()` to generate the PDF.
**When to use:** PDF exports that need charts, styled tables, branding.
**Example:**
```typescript
// Source: Context7 /puppeteer/puppeteer - page.pdf()
import puppeteer from 'puppeteer';

async function generatePagePdf(
  pageSlug: string,
  weekEnding: string,
  options: { landscape?: boolean } = {}
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Navigate to print-optimised route
  const url = `http://localhost:4200/print/${pageSlug}?week=${weekEnding}`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for charts to render
  await page.waitForSelector('[data-print-ready="true"]', { timeout: 10000 });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    landscape: options.landscape ?? false,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-size: 9px; width: 100%; padding: 0 20px; display: flex; justify-content: space-between;">
        <span>Buildable Approvals Pty Ltd</span>
        <span>Week ending: ${weekEnding}</span>
      </div>
    `,
    footerTemplate: `
      <div style="font-size: 8px; width: 100%; text-align: center; color: #999;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        &mdash; Generated <span class="date"></span>
      </div>
    `,
    margin: { top: '80px', bottom: '60px', left: '40px', right: '40px' },
  });

  await browser.close();
  return Buffer.from(pdfBuffer);
}
```

### Pattern 3: Xero OAuth2 with Encrypted Token Storage
**What:** Full OAuth2 authorization code flow with AES-256-GCM encrypted token persistence.
**When to use:** Xero integration.
**Example:**
```typescript
// Source: Context7 /xeroapi/xero-node + Node.js crypto docs
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.XERO_ENCRYPTION_KEY!, 'hex'); // 32 bytes

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### Pattern 4: Mock Mode Toggle for Xero
**What:** Environment variable `XERO_MOCK_MODE=true` returns canned responses instead of calling live API.
**When to use:** Development without Xero credentials, CI testing.
**Example:**
```typescript
class XeroSyncService {
  private mockMode: boolean;

  constructor() {
    this.mockMode = process.env.XERO_MOCK_MODE === 'true';
  }

  async syncProfitAndLoss(weekEnding: string) {
    if (this.mockMode) {
      return this.getMockPLData(weekEnding);
    }
    // Real API call via xero-node SDK
    const xero = await this.getAuthenticatedClient();
    const tenantId = xero.tenants[0].tenantId;
    const pl = await xero.accountingApi.getReportProfitAndLoss(
      tenantId, fromDate, toDate, undefined, undefined,
      undefined, undefined, undefined, undefined, true
    );
    return this.transformPLToFinancialWeekly(pl.body, weekEnding);
  }
}
```

### Anti-Patterns to Avoid
- **Client-side PDF generation (jsPDF/html2canvas):** Low fidelity, cannot capture SVG charts from Recharts properly, no real CSS rendering, huge bundle size. Always use server-side Puppeteer.
- **Polling for PDF readiness:** Instead, use a `data-print-ready` attribute pattern where the print page signals readiness after data load and chart render.
- **Storing Xero tokens as plaintext:** Must encrypt with AES-256-GCM before database storage. Use `Setting` model with encrypted JSON.
- **Calling Xero API without rate limiting:** Must implement sliding window or exponential backoff to respect 60 calls/min limit.
- **Single Puppeteer browser instance reused across requests:** Browser crashes can orphan the instance. Launch per-request or use a pool with health checks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV generation | Custom string concatenation | `Papa.unparse()` | Handles quoting, escaping, special chars, RFC 4180 compliance |
| PDF from HTML | Canvas-based screenshot → PDF | Puppeteer `page.pdf()` | Real browser rendering, proper pagination, header/footer support |
| Xero OAuth2 | Raw HTTP with manual PKCE | `xero-node` XeroClient | Token lifecycle, OpenID discovery, type-safe API methods |
| Cron scheduling | `setInterval()` + manual timing | `node-cron` | Proper cron syntax, timezone support, named tasks, start/stop |
| Token encryption | Custom XOR or Base64 "encoding" | Node.js `crypto` AES-256-GCM | Authenticated encryption, tamper detection, crypto-random IVs |
| Rate limiting | Request counter | Exponential backoff with 429 headers | Xero returns `X-MinLimit-Remaining` headers; respect them |

**Key insight:** PDF generation from React dashboards with live charts is fundamentally a browser rendering problem. Only a real browser engine (Puppeteer/Playwright) can faithfully render Recharts SVGs, Tailwind CSS, and responsive layouts. Any non-browser approach will require reimplementing the entire visual layer.

## Common Pitfalls

### Pitfall 1: Puppeteer Chromium Download on Windows
**What goes wrong:** Puppeteer auto-downloads ~280MB Chromium binary. On restricted Windows machines, firewall/antivirus may block the download or quarantine the binary.
**Why it happens:** Corporate environments often block unsigned executables or large binary downloads.
**How to avoid:** Test `npm install puppeteer` on the target Windows 11 machine first. If it fails, use `PUPPETEER_SKIP_DOWNLOAD=1` and point `executablePath` to a pre-installed Chrome/Edge. Edge (Chromium-based) at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` works as a fallback.
**Warning signs:** `Error: Could not find Chrome` at runtime, or `ENOENT` during install.

### Pitfall 2: PDF Blank Pages or Missing Charts
**What goes wrong:** Puppeteer generates the PDF before Recharts has rendered the SVG charts, resulting in blank chart areas.
**Why it happens:** `networkidle0` fires when there are no network requests, but Recharts animations and React state updates may still be pending.
**How to avoid:** Add a `data-print-ready="true"` attribute to the page root after all data is loaded and charts are rendered. Use `page.waitForSelector('[data-print-ready="true"]')` before calling `page.pdf()`. Also disable Recharts animations on print pages (`isAnimationActive={false}`).
**Warning signs:** PDF has loading spinners or empty chart containers.

### Pitfall 3: CSV Currency Symbols Breaking Excel
**What goes wrong:** Excel opens CSV and misinterprets `$1,234.56` as text, or `$` symbols cause formula injection.
**Why it happens:** Excel auto-detection doesn't handle currency-prefixed values well, especially with non-US locale settings.
**How to avoid:** Export currency values as plain numbers (e.g., `1234.56`) in the CSV and format the column header to indicate AUD. Add UTF-8 BOM (`\uFEFF`) so Excel recognises the encoding. Use Australian date format DD/MM/YYYY.
**Warning signs:** Excel shows `#VALUE!` or `$1` in columns, or dates are interpreted as MM/DD/YYYY.

### Pitfall 4: Xero Token Refresh Race Condition
**What goes wrong:** Multiple simultaneous API calls detect an expired token and all try to refresh it, causing "invalid_grant" errors because only one refresh succeeds.
**Why it happens:** Xero's refresh token is single-use; once consumed, the old refresh token is invalid.
**How to avoid:** Implement a token refresh mutex/lock. Before refreshing, acquire a lock. All other callers wait for the lock to release and then use the new token. Store token refresh timestamp and skip refresh if done within last few seconds.
**Warning signs:** Intermittent 401 errors during sync, especially when multiple sync operations overlap.

### Pitfall 5: Xero Rate Limit Exceeded During Bulk Sync
**What goes wrong:** Syncing P&L, invoices, and bank summary in rapid succession hits 60 calls/min limit.
**Why it happens:** Each sync operation may require multiple API calls (paginated results, multiple date ranges).
**How to avoid:** Implement a request queue with configurable concurrency (max 3-5 concurrent) and inter-request delay. Read `X-MinLimit-Remaining` header from each response and throttle when approaching 0. Use exponential backoff on 429 responses.
**Warning signs:** HTTP 429 responses, `X-MinLimit-Remaining: 0` in headers.

### Pitfall 6: Print Route Accessible Without Auth in Production
**What goes wrong:** The `/print/*` routes used by Puppeteer are accessible to anyone, exposing sensitive financial data.
**Why it happens:** Print routes need to be accessible to the Puppeteer browser instance which doesn't have user session cookies.
**How to avoid:** Use a short-lived, single-use token passed as a query parameter for print routes. Server generates a print token (UUID + expiry), Puppeteer navigates to `/print/financial?token=xxx`, print route validates and consumes the token. Alternative: Puppeteer sets a cookie before navigation.
**Warning signs:** Pentest reveals unauthenticated financial data endpoints.

## Code Examples

### CSV Export Utility (Client-Side)
```typescript
// Source: Context7 /mholt/papaparse - Papa.unparse()
// File: client/src/lib/csvExport.ts

import Papa from 'papaparse';

export interface CsvColumn<T = any> {
  key: string;
  label: string;
  format?: (value: any, row: T) => string;
}

const AUD_FORMATTER = (val: number | null) =>
  val != null ? val.toFixed(2) : '';

const DATE_FORMATTER_AU = (val: string | null) => {
  if (!val) return '';
  const d = new Date(val + (val.includes('T') ? '' : 'T00:00:00'));
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const PCT_FORMATTER = (val: number | null) =>
  val != null ? `${val.toFixed(1)}%` : '';

export { AUD_FORMATTER, DATE_FORMATTER_AU, PCT_FORMATTER };

export function downloadCsv<T extends Record<string, any>>(
  filename: string,
  columns: CsvColumn<T>[],
  data: T[]
): void {
  const rows = data.map(row =>
    Object.fromEntries(
      columns.map(col => [
        col.label,
        col.format ? col.format(row[col.key], row) : (row[col.key] ?? '')
      ])
    )
  );

  const csv = Papa.unparse(rows, {
    header: true,
    newline: '\r\n',
    quotes: true,
  });

  // BOM for Excel UTF-8 recognition
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

### PDF Export API Route (Server)
```typescript
// Source: Context7 /puppeteer/puppeteer - page.pdf()
// File: server/src/routes/exports.ts

import { Router } from 'express';
import puppeteer from 'puppeteer';

const router = Router();

const PAGE_CONFIG: Record<string, { landscape: boolean; title: string }> = {
  'executive-summary': { landscape: false, title: 'Executive Summary' },
  'financial':         { landscape: true,  title: 'Financial Deep Dive' },
  'regional':          { landscape: true,  title: 'Regional Performance' },
  'targets':           { landscape: false, title: 'Target Management' },
};

router.get('/pdf/:page', async (req, res) => {
  const { page: pageSlug } = req.params;
  const { week } = req.query;
  const config = PAGE_CONFIG[pageSlug];

  if (!config) return res.status(400).json({ error: 'Invalid page' });
  if (!week) return res.status(400).json({ error: 'week parameter required' });

  // Generate single-use print token
  const printToken = generatePrintToken(pageSlug, week as string);

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(
      `http://localhost:4200/print/${pageSlug}?week=${week}&token=${printToken}`,
      { waitUntil: 'networkidle0', timeout: 30000 }
    );
    await page.waitForSelector('[data-print-ready="true"]', { timeout: 15000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: config.landscape,
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: '80px', bottom: '60px', left: '40px', right: '40px' },
      // headerTemplate and footerTemplate with branding
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${config.title} - ${week}.pdf"`);
    res.send(Buffer.from(pdfBuffer));
  } finally {
    await browser.close();
  }
});
```

### Xero OAuth2 Callback Handler
```typescript
// Source: Context7 /xeroapi/xero-node
// File: server/src/routes/xero.ts

import { XeroClient, TokenSet } from 'xero-node';

const xero = new XeroClient({
  clientId: process.env.XERO_CLIENT_ID!,
  clientSecret: process.env.XERO_CLIENT_SECRET!,
  redirectUris: [`${process.env.SERVER_URL}/api/v1/xero/callback`],
  scopes: [
    'openid', 'profile', 'email',
    'accounting.settings', 'accounting.transactions',
    'accounting.reports.read', 'accounting.contacts.read',
    'offline_access'
  ],
});

router.get('/connect', async (_req, res) => {
  await xero.initialize();
  const consentUrl = await xero.buildConsentUrl();
  res.redirect(consentUrl);
});

router.get('/callback', async (req, res) => {
  const tokenSet: TokenSet = await xero.apiCallback(req.url);
  // Encrypt and store tokens
  await storeEncryptedTokens(tokenSet);
  const tenants = await xero.updateTenants();
  await storeTenantId(tenants[0].tenantId);
  res.redirect('/admin-settings?xero=connected');
});
```

### Xero P&L Sync Service
```typescript
// Source: Context7 /xeroapi/xero-node - getReportProfitAndLoss
// File: server/src/services/XeroSyncService.ts

async function syncProfitAndLoss(weekEnding: string): Promise<void> {
  if (process.env.XERO_MOCK_MODE === 'true') {
    return syncMockPL(weekEnding);
  }

  const xero = await getAuthenticatedClient();
  const tenantId = await getTenantId();

  // P&L for the week (Saturday to Saturday)
  const endDate = weekEnding;
  const startDate = subtractDays(weekEnding, 6); // Sunday

  const response = await callWithRetry(() =>
    xero.accountingApi.getReportProfitAndLoss(
      tenantId, startDate, endDate,
      undefined, undefined, undefined, undefined,
      undefined, undefined, true // standardLayout
    )
  );

  // Transform Xero report rows into financial_weekly record
  const plData = transformXeroReportToFinancialWeekly(response.body, weekEnding);

  await prisma.financialWeekly.upsert({
    where: { weekEnding: new Date(weekEnding) },
    create: { ...plData, dataSource: 'xero_api' },
    update: { ...plData, dataSource: 'xero_api' },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PhantomJS for PDF | Puppeteer headless Chrome | 2018 (PhantomJS EOL) | Puppeteer is the standard; PhantomJS abandoned |
| html2canvas + jsPDF | Puppeteer server-side | 2020+ | Server-side renders faithfully; client-side low fidelity |
| Xero Partner API (certificates) | Xero OAuth2 (xero-node v5+) | 2021 | Old certificate-based auth is deprecated |
| Custom OAuth2 implementation | xero-node SDK handles all OAuth2 | 2020+ | SDK manages token lifecycle, OpenID discovery |
| File-based CSV export on server | Client-side PapaParse unparse | 2022+ | Zero server round-trip for data already on client |

**Deprecated/outdated:**
- `xero-node` versions prior to v5: Used Partner API and certificate-based auth, fully deprecated by Xero
- `html2pdf.js`, `html2canvas`: Poor fidelity for complex dashboards with SVG charts
- PhantomJS: Abandoned in 2018, security vulnerabilities

## Open Questions

1. **Puppeteer Chromium Binary on Target Server**
   - What we know: Puppeteer downloads ~280MB Chromium binary. Windows 11 is the target.
   - What's unclear: Whether the production Windows 11 machine has firewall restrictions that block the Chromium download, or antivirus that quarantines it.
   - Recommendation: Test `npm install puppeteer` on the production machine early. If blocked, fall back to using Edge's Chromium binary via `executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'` with `puppeteer-core` instead.

2. **Print Route Authentication Strategy**
   - What we know: Puppeteer navigates to a URL to render PDF. The browser instance has no user session.
   - What's unclear: Whether the dev-mode auto-auth bypass is sufficient for now, or if a proper print token system is needed immediately.
   - Recommendation: For Phase 3 in dev mode, the existing `NODE_ENV=development` auto-auth bypass will work. Add a TODO for production print token system in Phase 4 (validation). The print route is internal-only (localhost).

3. **Xero SDK Version Stability**
   - What we know: xero-node is actively maintained by Xero. The SDK provides typed APIs for all needed endpoints.
   - What's unclear: Whether xero-node has breaking changes between latest and what Context7 documents.
   - Recommendation: Pin version at install time; use caret range for patches only. The API surface documented by Context7 (XeroClient, accountingApi, financeApi) is stable.

4. **Recharts SVG Export in Print Mode**
   - What we know: Recharts renders SVGs into the DOM. Puppeteer's PDF engine captures these.
   - What's unclear: Whether animation states or responsive container resizing causes issues at print time.
   - Recommendation: Create print page variants with `isAnimationActive={false}` on all Recharts components and fixed-width containers (not responsive). Test thoroughly.

## Existing Codebase Integration Points

### Files to Modify
| File | Change |
|------|--------|
| `client/src/components/ui/ExportButtons.tsx` | Replace `alert()` stubs with real CSV + PDF export handlers |
| `client/src/components/admin/SystemStatus.tsx` | Make Xero card interactive (connect/disconnect, status display) |
| `server/src/index.ts` | Register new routes: `/api/v1/exports/*`, `/api/v1/xero/*` |
| `server/prisma/schema.prisma` | Add `XeroToken` model for encrypted token storage |

### Files to Create
| File | Purpose |
|------|---------|
| `client/src/lib/csvExport.ts` | Client-side CSV generation utility |
| `client/src/lib/exportApi.ts` | API client for PDF export + Xero endpoints |
| `client/src/components/print/` | Print-optimised page variants (one per dashboard page) |
| `server/src/routes/exports.ts` | PDF export routes |
| `server/src/routes/xero.ts` | Xero OAuth + sync routes |
| `server/src/services/PdfExportService.ts` | Puppeteer PDF generation |
| `server/src/services/XeroAuthService.ts` | OAuth2 flow + encrypted token management |
| `server/src/services/XeroSyncService.ts` | Data sync from Xero to database |
| `server/src/services/XeroScheduler.ts` | node-cron daily sync |

### Database Schema Additions
```prisma
model XeroToken {
  id             Int      @id @default(autoincrement())
  tenantId       String   @unique @map("tenant_id")
  tenantName     String   @map("tenant_name")
  accessToken    String   @map("access_token")    // AES-256-GCM encrypted
  refreshToken   String   @map("refresh_token")   // AES-256-GCM encrypted
  idToken        String?  @map("id_token")
  tokenType      String   @map("token_type")
  expiresAt      DateTime @map("expires_at")
  scope          String
  connectedAt    DateTime @default(now()) @map("connected_at")
  lastSyncAt     DateTime? @map("last_sync_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@map("xero_tokens")
}

model XeroSyncLog {
  id          Int      @id @default(autoincrement())
  syncType    String   @map("sync_type")    // 'profit_and_loss', 'invoices', 'bank_summary'
  weekEnding  DateTime @map("week_ending") @db.Date
  status      String   // 'success', 'failed', 'partial'
  recordCount Int      @default(0) @map("record_count")
  errorLog    Json?    @map("error_log")
  startedAt   DateTime @default(now()) @map("started_at")
  completedAt DateTime? @map("completed_at")

  @@map("xero_sync_logs")
}
```

### Xero Rate Limits (Verified)
| Limit | Value | Scope |
|-------|-------|-------|
| Concurrent | 5 calls in progress | Per tenant per app |
| Minute | 60 calls/min | Per tenant per app |
| Daily | 5,000 calls/day | Per tenant per app |
| App-wide minute | 10,000 calls/min | Across all tenants |
| Response headers | `X-DayLimit-Remaining`, `X-MinLimit-Remaining`, `X-AppMinLimit-Remaining` | Every response |
| 429 handling | Exponential backoff (2^attempt seconds) | Required |

## Sources

### Primary (HIGH confidence)
- Context7 `/puppeteer/puppeteer` (v24.x) - PDF generation options, page.pdf() API, installation
- Context7 `/xeroapi/xero-node` - OAuth2 flow, XeroClient config, accountingApi, financeApi, error handling
- Context7 `/mholt/papaparse` - Papa.unparse() API for CSV generation

### Secondary (MEDIUM confidence)
- [Puppeteer Installation Guide](https://pptr.dev/guides/installation) - Windows binary download ~280MB, cache location
- [Xero API Rate Limits](https://developer.xero.com/documentation/best-practices/api-call-efficiencies/rate-limits) - 60/min, 5000/day, concurrent limits
- [Xero OAuth2 Limits](https://developer.xero.com/documentation/guides/oauth2/limits/) - Token lifecycle details
- [Node.js crypto documentation](https://nodejs.org/api/crypto.html) - AES-256-GCM authenticated encryption

### Tertiary (LOW confidence)
- WebSearch: Puppeteer vs Playwright for PDF (2026) - both viable, Puppeteer more focused
- WebSearch: node-cron for Express scheduling - widely used, no breaking changes

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Core libraries verified via Context7 with current docs and code examples
- Architecture: HIGH - Patterns are well-established (Puppeteer PDF, client-side CSV, xero-node OAuth2)
- Pitfalls: HIGH - Based on Context7 documentation, official Xero docs, and verified platform constraints
- Xero mock mode: MEDIUM - Pattern is straightforward but untested against live API (by design)

**Research date:** 2026-02-06
**Valid until:** 2026-03-08 (30 days -- stable domain, libraries are mature)
