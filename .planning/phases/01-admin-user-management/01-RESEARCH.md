# Phase 1: Admin & User Management - Research

**Researched:** 2026-02-06
**Domain:** Admin settings CRUD, user management, permission matrix, file upload, branding
**Confidence:** HIGH

## Summary

Phase 1 builds two distinct features on top of a mature brownfield codebase: an Admin Settings page (branding, pass-through items, alert thresholds, system status) and a User Management page (user list, role assignment, permission matrix). The codebase already has all the foundational pieces in place: Prisma schema with `Setting` model (key-value JSON store), `User` and `UserPermission` models with full enum support (`UserRole`, `PermissionLevel`, `DashboardPage`), auth middleware with dev bypass, permission middleware with role defaults, Zod validation, Multer for file uploads, and an established React component pattern (fetch in useEffect, loading/error/data states).

The primary technical challenges are: (1) logo file upload and serving (no static file serving exists yet -- needs `express.static` setup and a dedicated uploads directory), (2) applying branding settings globally across the React app (requires a settings context provider or similar mechanism), (3) the N+1 query issue in the permission middleware (each route call makes a DB query per user-permission check -- should batch-load permissions), and (4) building a clean permission matrix UI with inline dropdowns for 13 pages x N users.

**Primary recommendation:** Use the existing `Setting` model as-is for all settings storage (branding config, pass-through items, alert thresholds). Store the logo as a file on disk served via `express.static`, with the file path stored in `Setting`. Build a `SettingsContext` in React that loads all settings once and broadcasts changes. For the permission matrix, eagerly load all permissions per user (the schema already supports this via `include: { permissions: true }`).

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | ^4.21.2 | HTTP server, routing, static file serving | Already in use across all routes |
| Prisma | ^6.3.0 | ORM for Setting, User, UserPermission tables | Already powers all data access |
| Zod | ^3.24.1 | Request validation (body + query) | Already used in validation middleware |
| Multer | ^1.4.5-lts.1 | File upload handling (logo) | Already configured for CSV uploads |
| React | ^19.2.0 | UI components | Already powering entire frontend |
| Tailwind CSS | ^4.1.18 | Styling | Already used throughout, Asana design language |

### Supporting (No New Dependencies Required)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `express.static` | built-in | Serve uploaded logo files | Logo upload feature |
| `fs/promises` | built-in (Node) | File system operations for logo save/delete | Logo upload backend |
| `path` | built-in (Node) | Cross-platform path handling | Logo file paths |
| `crypto` | built-in (Node) | Generate unique file names for uploaded logos | Avoid name collisions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Disk storage for logos | Base64 in database (Setting JSON) | Base64 bloats DB and is slower for serving; disk + express.static is simpler and faster |
| Custom colour picker | npm colour picker library (react-colorful) | Extra dependency for minimal gain; preset swatches + hex input can be built with plain HTML input[type=color] + Tailwind |
| React context for settings | Prop drilling or Zustand | Context is sufficient for ~5 settings values; no need for state management library |

**Installation:** No new npm packages required. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure

```
server/src/
  routes/
    settings.ts          # NEW - Admin settings CRUD endpoints
    users.ts             # NEW - User management endpoints
  services/
    SettingsService.ts   # NEW - Settings business logic
  uploads/               # NEW - Directory for uploaded files (logo)

client/src/
  lib/
    settingsApi.ts       # NEW - Settings API client
    userApi.ts           # NEW - User management API client
    SettingsContext.tsx   # NEW - Global settings provider
  components/
    admin/
      AdminSettings.tsx       # NEW - Main settings page container
      BrandingSection.tsx     # NEW - Logo upload, company name, colours
      PassThroughSection.tsx  # NEW - Pass-through items tag list
      AlertThresholds.tsx     # NEW - Threshold config with sliders
      SystemStatus.tsx        # NEW - Placeholder integration cards
    users/
      UserManagement.tsx      # NEW - Main user management page
      UserTable.tsx           # NEW - User list table
      PermissionMatrix.tsx    # NEW - Permission grid
      RoleConfirmDialog.tsx   # NEW - Role change confirmation modal
```

### Pattern 1: Settings as Key-Value JSON Store

**What:** Use the existing `Setting` model (`key: string, value: Json`) as a flexible key-value store for all admin settings. Each setting category gets its own key with a structured JSON value.
**When to use:** All admin settings (branding, pass-through items, alert thresholds).

**Setting keys:**
```typescript
// Branding
{ key: 'branding', value: { companyName: string, logoPath: string | null, primaryColour: string, accentColour: string } }

// Pass-through items (already partially used in dashboard.ts line 301-307)
{ key: 'pass_through_categories', value: string[] }  // e.g. ['council_fees', 'insurance_levy']

// Alert thresholds
{ key: 'alert_thresholds', value: AlertThreshold[] }
// where AlertThreshold = { metric: string, warningValue: number, criticalValue: number, direction: 'below' | 'above' }

// Backup status (informational only)
{ key: 'backup_status', value: { lastBackup: string | null, status: string } }
```

**Why this works:** The `Setting` model already exists in the schema with a `Json` value field. The Financial Deep Dive route already reads `pass_through_categories` from it (see `dashboard.ts` line 301-307). This pattern is extensible -- new settings categories just need new keys.

### Pattern 2: File Upload + Static Serving for Logo

**What:** Upload logo via Multer (memory storage), validate image type/size, write to `server/uploads/` directory with a unique filename, serve via `express.static`, store the relative path in the `branding` setting.
**When to use:** Logo upload feature.

```typescript
// Server: express.static for uploads
app.use('/api/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Route: Logo upload
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max for logo
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.post('/branding/logo', logoUpload.single('logo'), async (req, res, next) => {
  // Save file to disk with unique name
  const ext = path.extname(req.file.originalname);
  const filename = `logo-${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(UPLOADS_DIR, filename), req.file.buffer);

  // Update setting
  await prisma.setting.upsert({
    where: { key: 'branding' },
    update: { value: { ...existing, logoPath: `/api/uploads/${filename}` } },
    create: { key: 'branding', value: { logoPath: `/api/uploads/${filename}`, ... } },
  });

  // Delete old logo file if exists
  res.json({ logoPath: `/api/uploads/${filename}` });
});
```

### Pattern 3: Settings Context Provider (React)

**What:** A React context that loads all settings on app init and provides them to every component. Includes a refresh function for after settings are saved.
**When to use:** Anywhere branding/settings are consumed (header, sidebar, KPI cards for alert colours).

```typescript
interface SettingsContextValue {
  branding: BrandingSettings | null;
  alertThresholds: AlertThreshold[];
  passThroughCategories: string[];
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

// Wrap the app: <SettingsProvider><WeekProvider>...<App/></WeekProvider></SettingsProvider>
```

**Why:** Branding must appear in the sidebar (logo, company name), top bar, and eventually login/PDF. A context provider makes these values available everywhere without prop drilling.

### Pattern 4: Permission Matrix Batch Operations

**What:** When loading or saving the permission matrix, operate on all permissions for a user at once rather than per-cell.
**When to use:** User management permission grid.

```typescript
// Backend: GET /api/v1/users/:id/permissions returns all permissions
// Backend: PUT /api/v1/users/:id/permissions accepts full permission set
// This avoids N+1 on both read and write

// Schema supports this via:
// User model has: permissions UserPermission[]
// UserPermission has: @@unique([userId, page])
```

### Pattern 5: Express Route + Zod Validation (Existing Pattern)

**What:** Follow the exact pattern used in `targets.ts` and `uploads.ts` -- Router, Zod schema, validateBody/validateQuery middleware, try/catch with next(err).
**When to use:** All new routes.

```typescript
const router = Router();

const updateBrandingSchema = z.object({
  companyName: z.string().min(1).max(100),
  primaryColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

router.put('/branding', validateBody(updateBrandingSchema), async (req, res, next) => {
  try {
    const data = (req as any).validated;
    // ... service call
    res.json(result);
  } catch (err) { next(err); }
});
```

### Anti-Patterns to Avoid

- **Auto-save on every field change:** The context says "explicit Save button to persist -- no auto-save." Do not debounce-save settings on change. Maintain local form state and save on button click.
- **Fetching settings per-component:** Do not have multiple components independently fetching branding. Load once in SettingsContext, consume everywhere.
- **Storing logo as base64 in the database:** The `Setting.value` is JSON. Base64 images in JSON fields are slow to query and bloat the database. Use file system + static serving.
- **Per-cell permission saves:** Do not save each permission cell individually as the user toggles dropdowns. Collect changes in local state, save the full permission set on explicit Save.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload handling | Custom multipart parser | Multer (already installed) | Handles edge cases (encoding, size limits, file types) |
| Request validation | Manual if/else checks | Zod + validateBody/validateQuery (already in middleware) | Type-safe, consistent error format |
| Colour validation | Regex-only hex validation | HTML `<input type="color">` for picker + Zod regex for API | Browser handles colour picker UX natively |
| Permission defaults | Hard-coded per-route logic | Existing `permissions.ts` middleware + ROLE_DEFAULTS map | Already implemented and tested |
| Unique file names | Timestamp concatenation | `crypto.randomUUID()` (Node built-in) | Guaranteed unique, no race conditions |

**Key insight:** This phase is almost entirely CRUD operations on existing database tables with existing patterns. The codebase already has every pattern needed (Multer, Zod, Prisma upsert, React context). The work is assembly, not invention.

## Common Pitfalls

### Pitfall 1: N+1 Query in Permission Middleware
**What goes wrong:** The existing `resolvePermission` function in `permissions.ts` makes a separate `prisma.userPermission.findUnique` call for every protected route hit. If a page load triggers 5 API calls, that's 5 separate permission queries.
**Why it happens:** The middleware was designed for simplicity, not efficiency. Each route independently resolves permissions.
**How to avoid:** Cache permissions on `req.user` during authentication. In `auth.ts`, the `getUserWithPermissions` call already includes permissions (`include: { permissions: true }`). Modify `resolvePermission` to check `req.user.permissions` array first before querying the database. This eliminates all per-route permission queries.
**Warning signs:** Slow response times, many small queries in Prisma debug logs.

### Pitfall 2: Platform-Specific File Paths
**What goes wrong:** Using `\` backslashes or platform-specific path separators in file paths breaks on different OS (Windows dev vs potential future Linux deploy).
**Why it happens:** Windows uses `\`, the web uses `/`. The project constraint says "all paths/configs must be platform-agnostic."
**How to avoid:** Always use `path.join()` for filesystem operations and `/` forward slashes for URL paths. Store only the URL path in settings, not filesystem paths.
**Warning signs:** Logo images not loading, 404 errors on uploaded files.

### Pitfall 3: Settings Race Condition on Save
**What goes wrong:** If branding settings include both a JSON update (company name, colours) and a file upload (logo), saving them separately can create a race condition where the logo path is overwritten.
**Why it happens:** Separate endpoints for logo upload and branding text settings both update the same `branding` key in the Setting table.
**How to avoid:** Use Prisma's JSON update to merge fields rather than replace the entire JSON value. Or handle logo upload as part of the branding save endpoint (multipart form with both file and JSON).
**Warning signs:** Logo disappears after saving company name, or company name resets after uploading logo.

### Pitfall 4: Stale Settings Context After Save
**What goes wrong:** Admin saves new branding in the settings page, but the sidebar/header still shows old branding until page refresh.
**Why it happens:** React context doesn't automatically refetch data.
**How to avoid:** After successful save, call `refreshSettings()` from the SettingsContext to re-fetch from the API. The settings page's save handler should trigger this.
**Warning signs:** Branding changes not appearing until browser refresh.

### Pitfall 5: Permission Matrix State Complexity
**What goes wrong:** Managing unsaved changes for multiple users' permissions becomes buggy -- edits to one user bleed into another, or the save button doesn't know which users changed.
**Why it happens:** The matrix has many cells (13 pages x N users) and needs to track dirty state.
**How to avoid:** Track permissions per-user, not per-cell. When a user row is being edited, maintain a local copy of that user's full permission set. On save, diff against the original and only send changes. Use a `Map<userId, PermissionLevel[]>` for local state.
**Warning signs:** Saving one user's permissions resets another user's unsaved changes.

### Pitfall 6: DashboardPage Enum Mismatch
**What goes wrong:** The Prisma `DashboardPage` enum has 13 entries. The frontend sidebar has 10 `PageId` entries. These don't map 1:1 (e.g., `financial_deep_dive` vs `financial` in sidebar, some pages like `pl_monthly_detail` exist in the enum but not sidebar).
**Why it happens:** The database enum was designed for fine-grained permission control, while the sidebar uses simplified page IDs.
**How to avoid:** Create a mapping between `DashboardPage` enum values and user-facing labels in the permission matrix. Show all 13 DashboardPage values in the permission matrix, even if some pages aren't in the sidebar yet. Group related pages visually.
**Warning signs:** Permission matrix missing pages, or permissions set for pages that don't appear in the UI.

## Code Examples

### Settings API Routes (Backend Pattern)

```typescript
// server/src/routes/settings.ts
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../db.js';
import { validateBody } from '../middleware/validation.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

// GET /settings — Fetch all settings (public to authenticated users for branding)
router.get('/', async (_req, res, next) => {
  try {
    const settings = await prisma.setting.findMany();
    const result: Record<string, any> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    res.json(result);
  } catch (err) { next(err); }
});

// PUT /settings/:key — Update a single setting (admin only)
router.put('/:key',
  requirePermission('admin_settings', 'write'),
  async (req, res, next) => {
    try {
      const { key } = req.params;
      const setting = await prisma.setting.upsert({
        where: { key },
        update: { value: req.body.value },
        create: { key, value: req.body.value },
      });
      res.json(setting);
    } catch (err) { next(err); }
  }
);

export default router;
```

### Settings Context (Frontend Pattern)

```typescript
// client/src/lib/SettingsContext.tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface BrandingSettings {
  companyName: string;
  logoPath: string | null;
  primaryColour: string;
  accentColour: string;
}

interface SettingsContextValue {
  branding: BrandingSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const DEFAULTS: BrandingSettings = {
  companyName: 'Buildable',
  logoPath: null,
  primaryColour: '#4573D2',
  accentColour: '#4573D2',
};

const SettingsContext = createContext<SettingsContextValue>({
  branding: DEFAULTS,
  loading: true,
  refreshSettings: async () => {},
});

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch('/api/v1/settings');
      const data = await res.json();
      if (data.branding) setBranding({ ...DEFAULTS, ...data.branding });
    } catch { /* use defaults */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <SettingsContext.Provider value={{ branding, loading, refreshSettings: load }}>
      {children}
    </SettingsContext.Provider>
  );
}
```

### User Management API Routes (Backend Pattern)

```typescript
// server/src/routes/users.ts
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../db.js';
import { validateBody } from '../middleware/validation.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

// GET / — List all users with permissions
router.get('/',
  requirePermission('user_permission_management', 'read'),
  async (_req, res, next) => {
    try {
      const users = await prisma.user.findMany({
        include: { permissions: true },
        orderBy: { displayName: 'asc' },
      });
      res.json(users);
    } catch (err) { next(err); }
  }
);

// PUT /:id/role — Update user role
const updateRoleSchema = z.object({
  role: z.enum(['super_admin', 'executive', 'manager', 'staff']),
  applyDefaults: z.boolean().default(false),
});

router.put('/:id/role',
  requirePermission('user_permission_management', 'write'),
  validateBody(updateRoleSchema),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { role, applyDefaults } = (req as any).validated;

      const user = await prisma.user.update({
        where: { id },
        data: { role },
        include: { permissions: true },
      });

      if (applyDefaults) {
        // Delete existing permissions and apply role defaults
        await prisma.userPermission.deleteMany({ where: { userId: id } });
        // Create default permissions based on role
        // ... (role-based defaults from ROLE_DEFAULTS)
      }

      res.json(user);
    } catch (err) { next(err); }
  }
);

// PUT /:id/permissions — Bulk update permissions
const permissionsSchema = z.array(z.object({
  page: z.enum([/* all DashboardPage values */]),
  permissionLevel: z.enum(['read', 'write', 'no_access']),
}));

router.put('/:id/permissions',
  requirePermission('user_permission_management', 'write'),
  validateBody(z.object({ permissions: permissionsSchema })),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { permissions } = (req as any).validated;

      // Transaction: delete all, then create new
      await prisma.$transaction([
        prisma.userPermission.deleteMany({ where: { userId: id } }),
        ...permissions.map((p: any) =>
          prisma.userPermission.create({
            data: { userId: id, page: p.page, permissionLevel: p.permissionLevel },
          })
        ),
      ]);

      const user = await prisma.user.findUnique({
        where: { id },
        include: { permissions: true },
      });
      res.json(user);
    } catch (err) { next(err); }
  }
);

export default router;
```

### Alert Threshold Data Structure

```typescript
interface AlertThreshold {
  metric: string;           // 'net_profit' | 'team_revenue_performance' | 'cash_position'
  label: string;            // Display label
  direction: 'below' | 'above';  // 'below' for profit, 'above' for ratio
  warningValue: number;     // Amber threshold
  criticalValue: number;    // Red threshold
  unit: 'currency' | 'percentage'; // For display formatting
}

// Default thresholds:
const DEFAULT_THRESHOLDS: AlertThreshold[] = [
  {
    metric: 'net_profit',
    label: 'Net Profit Below Budget',
    direction: 'below',
    warningValue: 80,    // Warning when below 80% of budget
    criticalValue: 50,   // Critical when below 50% of budget
    unit: 'percentage',
  },
  {
    metric: 'team_revenue_performance',
    label: 'Team Revenue Performance',
    direction: 'below',
    warningValue: 70,
    criticalValue: 50,
    unit: 'percentage',
  },
  {
    metric: 'cash_position',
    label: 'Cash Approaching Overdraft',
    direction: 'below',
    warningValue: 50000,
    criticalValue: 20000,
    unit: 'currency',
  },
];
```

### Pass-Through Items Tag List Component

```typescript
// Recommended: inline tag-list pattern (Claude's Discretion decision)
// Rationale: pass-through items are a short list (2-5 items typically),
// tag-list is more compact and intuitive than a table for this use case.

interface PassThroughSectionProps {
  items: string[];
  availableCategories: string[]; // From RevenueCategory enum
  onChange: (items: string[]) => void;
}

// UI: dropdown to select from available RevenueCategory values
// + tag badges showing current items with X button to remove
// This matches the tag-list pattern from CONTEXT.md
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `DEFAULT_PASS_THROUGH` hard-coded in dashboard.ts | Settings table query (already partially implemented) | Already in code (line 301-307 of dashboard.ts) | Pass-through items already load from DB with fallback to default |
| No branding support | SettingsContext + Setting model | This phase | Sidebar, header, and future PDF exports will use dynamic branding |
| Permission check per route | Cached permissions on req.user | This phase (fix N+1) | Eliminates redundant DB queries |

**Current state of key existing code:**
- `dashboard.ts` line 301-307: Already reads `pass_through_categories` from `Setting` table with fallback to `['council_fees']`. The admin settings UI just needs to write to this same key.
- `permissions.ts`: Has `ROLE_DEFAULTS`, `ADMIN_ONLY_PAGES`, `STAFF_READABLE_PAGES` -- these define the default permission logic that must be replicated when "Apply default permissions for [Role]?" is confirmed.
- `auth.ts` line 54: `getUserWithPermissions` already does `include: { permissions: true }` -- permissions are already loaded, just not used by `resolvePermission`. Fix: pass the loaded permissions to `resolvePermission` instead of re-querying.

## Open Questions

1. **Logo storage location on Windows**
   - What we know: The server runs on Windows 11 local server. `server/uploads/` is a reasonable default location.
   - What's unclear: Whether the uploads directory should be inside the server dist or outside it (relative to project root). Inside `server/` is simpler; outside would survive a clean rebuild.
   - Recommendation: Use `server/uploads/` and add it to `.gitignore`. Create the directory on startup if it doesn't exist. This is simple and works for the single-server deployment.

2. **Branding on login page**
   - What we know: CONTEXT says branding appears on login page. But the login page is part of M365 SSO redirect flow (Azure AD consent screen), which we don't control.
   - What's unclear: Whether there is a custom login page wrapper before redirect.
   - Recommendation: Currently there is no custom login page in the frontend (auth is dev-bypass only). Apply branding to whatever login UI exists when M365 SSO is wired up. For now, just apply branding to sidebar + header.

3. **Dev mode user creation (USER-05)**
   - What we know: The seed.ts already creates test users. USER-05 asks for "dev mode manual user creation for testing."
   - What's unclear: Whether this means a UI form or just API endpoint.
   - Recommendation: Add a "Create User" button in User Management that's visible in dev mode. Backed by a POST endpoint. Simple form: name, email, role.

4. **Backup status display (ADMN-06)**
   - What we know: Shows last backup timestamp and informational status. There's no backup system built yet.
   - What's unclear: What writes the backup status. This is purely informational.
   - Recommendation: Store a `backup_status` setting key. For now, display a card showing "No backup configured" or the stored timestamp. The actual backup system (likely a scheduled script) will write to this key in future phases.

## Sources

### Primary (HIGH confidence)
- **Prisma schema** (`server/prisma/schema.prisma`): Verified Setting model, User model, UserPermission model, DashboardPage enum, UserRole enum, PermissionLevel enum
- **Existing middleware** (`server/src/middleware/auth.ts`, `permissions.ts`): Verified auth flow, permission resolution logic, ROLE_DEFAULTS
- **Existing routes** (`server/src/routes/dashboard.ts`): Verified pass-through settings usage at line 301-307
- **Existing uploads** (`server/src/routes/uploads.ts`): Verified Multer configuration pattern
- **Frontend patterns** (`client/src/lib/WeekContext.tsx`, `dashboardApi.ts`, `api.ts`): Verified React context pattern, API client pattern
- **Package.json files**: Verified exact dependency versions

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions: User-confirmed implementation decisions (branding, layout, permissions UX)

### Tertiary (LOW confidence)
- None. All research based on direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and verified in package.json
- Architecture: HIGH - Patterns directly derived from existing codebase patterns
- Pitfalls: HIGH - Identified from code inspection (N+1 in permissions.ts, pass-through in dashboard.ts)

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable -- codebase is brownfield, no external API volatility)
