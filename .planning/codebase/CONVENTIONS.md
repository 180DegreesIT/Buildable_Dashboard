# Coding Conventions

**Analysis Date:** 2026-02-06

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `ExecutiveSummary.tsx`, `KPICard.tsx`, `UploadWizard.tsx`)
- Services: PascalCase class-based (e.g., `WeekService.ts`, `FinancialService.ts`, `AuthService.ts`, `CsvParserService.ts`)
- API/utility functions: camelCase (e.g., `api.ts`, `dashboardApi.ts`, `targetApi.ts`)
- Middleware: camelCase (e.g., `errorHandler.ts`, `validation.ts`, `auth.ts`, `permissions.ts`)
- Context/hooks: PascalCase for components/providers, lowercase for hook files (e.g., `WeekContext.tsx`)
- Directories: kebab-case (e.g., `dashboard/`, `upload/`, `targets/`, `layout/`)

**Functions:**
- Async functions and service methods: camelCase (e.g., `fetchExecutiveSummary()`, `getWeeklySummary()`, `importRows()`)
- React event handlers: camelCase with `handle` prefix (e.g., `handleNavigate()`, `handleSort()`, `handleValidate()`)
- Internal helper functions: camelCase (e.g., `fmtAUD()`, `toSaturday()`, `buildPLRows()`)
- Static class methods: camelCase (e.g., `AuthService.signToken()`, `WeekService.toSaturday()`)

**Variables:**
- State variables: camelCase (e.g., `selectedWeek`, `loading`, `mapping`, `validating`)
- Constants: UPPER_SNAKE_CASE (e.g., `STEP_LABELS`, `SATURDAY = 6`, `JWT_SECRET`)
- Type/interface variables: PascalCase (e.g., `DataTypeDefinition`, `ExecutiveSummaryData`)
- Boolean flags: camelCase (e.g., `isActive`, `hasData`, `isLoading`, `autoMapped`)

**Types:**
- Interfaces/types: PascalCase (e.g., `KPICardProps`, `WizardState`, `ExecutiveSummaryData`)
- Enum values: UPPER_SNAKE_CASE in TypeScript enums
- Generic type parameters: Single uppercase letter (e.g., `<T>`) or PascalCase descriptive (e.g., `<TData>`)

## Code Style

**Formatting:**
- No explicit formatter configured; code follows standard TypeScript/React conventions
- Indentation: 2 spaces (observed in all files)
- Line length: No hard limit enforced, but code breaks around 100–120 characters where readable
- Semicolons: Required (TypeScript strict mode)
- Trailing commas: Used in multi-line objects/arrays

**Linting:**
- Tool: ESLint 9 (flat config, `eslint.config.js`)
- Rules: TypeScript ESLint recommended + React hooks recommended + React refresh plugin
- Strict TypeScript: `strict: true` (client: `tsconfig.app.json`, server: `tsconfig.json`)
- Key rules enforced:
  - `noUnusedLocals`: true
  - `noUnusedParameters`: true
  - `noFallthroughCasesInSwitch`: true
  - `noUncheckedSideEffectImports`: true (client only)

**Client-specific (Vite):**
- React JSX transform: `jsx: "react-jsx"`
- Module resolution: bundler
- Target: ES2022

**Server-specific (Node.js):**
- Module resolution: NodeNext
- Target: ES2022
- Import extensions: ESM (`.js` extensions required in imports)

## Import Organization

**Order:**
1. React/external libraries (`import { useState } from 'react'`)
2. Project dependencies (services, utils, types) (`import { WeekService } from '../services/...'`)
3. Components (child components or component imports)
4. Styling (CSS imports or Tailwind directives)
5. Type-only imports (e.g., `import type { PageId }`)

**Path Aliases:**
- Not configured; all imports use relative paths
- Frontend imports: relative paths like `../../lib/api`, `../ui/KPICard`
- Backend imports: relative with `.js` extensions (ESM): `../services/AuthService.js`

**Type imports:**
- Use `import type` for type-only imports to avoid circular dependencies (e.g., `import type { User } from '../generated/prisma/index.js'`)
- Declarations of Request properties: `declare global { namespace Express { ... } }`

## Error Handling

**Patterns:**

### Backend (Express):
- Custom `ApiError` class with status codes (`src/middleware/errorHandler.ts`):
  ```typescript
  export class ApiError extends Error {
    constructor(public statusCode: number, message: string)
  }

  // Static factory methods:
  ApiError.badRequest(message)    // 400
  ApiError.notFound(message)      // 404
  ```
- Try-catch in route handlers with `next(err)` delegation to error middleware
- Error middleware logs to console and responds with `{ error: { message, statusCode } }` JSON

### Frontend (React):
- Try-catch in async functions, set error state: `setError(err.message)`
- Error boundaries implicit (no component-level boundary defined; relies on error state)
- Async operations track `cancelled` flag to prevent state updates on unmounted components:
  ```typescript
  const [cancelled, setCancelled] = useState(false);
  useEffect(() => {
    return () => { cancelled = true; };
  }, []);
  ```
- Fetch wrapper in `src/lib/api.ts`: wraps responses, throws on non-2xx, extracts error message from JSON body

**HTTP Status Codes:**
- 200/204: Success
- 400: Validation errors (via `validateQuery`/`validateBody` middleware)
- 401: Missing/invalid authentication
- 403: Insufficient permissions
- 404: Resource not found
- 500: Unhandled server errors

## Logging

**Framework:** Console (no centralized logging library)

**Patterns:**
- Backend: `console.error('[Error] ${err.message}', err.stack)` in error handler
- Frontend: Minimal logging; errors set in state and displayed via `EmptyState` component
- No request logging middleware configured

## Comments

**When to Comment:**
- JSDoc/TSDoc comments on exported functions and types (frontend API layer)
- Section dividers with `// ─── Section Name ────────────────────────────` for logical grouping
- Explain non-obvious business logic (e.g., date snapping rules, financial calculations)
- Mark unsafe/temporary code (`// TODO` discouraged; use inline comment instead)

**JSDoc/TSDoc:**
```typescript
/**
 * Returns the nearest Saturday to the given date.
 * If the date is already a Saturday, returns it unchanged.
 */
static toSaturday(date: Date): Date
```
- Function/method documentation above definition
- Parameter/return types in signature (TypeScript strict mode)
- Inline comments for complex calculations

## Function Design

**Size:**
- Small, focused functions preferred (typically 30–60 lines for service methods)
- Large components acceptable for complex UI (e.g., `ExecutiveSummary.tsx` 403 lines) but prefer sub-component extraction where feasible
- Helper functions factored into separate functions within the module (e.g., `fmtAUD()`, `buildPLRows()`)

**Parameters:**
- Named parameters: Use object params for functions with >2 args
  ```typescript
  export async function importData(params: {
    dataTypeId: string;
    fileName: string;
    mappingId?: number;
    rows: RowValidation[];
    duplicateStrategy: 'overwrite' | 'skip' | 'merge';
  }): Promise<ImportResult>
  ```
- Optional fields use `?` in object types or default values in destructuring

**Return Values:**
- Async functions return Promise<T>
- Void returns used for side-effect functions (event handlers, middleware)
- Null/undefined for "not found" (e.g., `getWeeklySummary()` returns `null` if no data)
- Union types for status: `{ status: 'completed' | 'failed', ... }`

## Module Design

**Exports:**
- Default export for single-responsibility modules (components, single service)
  ```typescript
  export default function KPICard() { ... }
  ```
- Named exports for utility functions and types
  ```typescript
  export interface DataTypeDefinition { ... }
  export async function fetchDataTypes() { ... }
  ```

**Barrel Files:**
- Not used; import directly from source files
- Generated Prisma exports use `src/generated/prisma/index.js` for re-exports

**Circular Dependencies:**
- Avoided by type-only imports (`import type { ... }`)
- Service layer does not import routes; routes import services

## Constants & Configuration

**Environment variables:**
- Backend: `dotenv.config()` loads `.env` file
- Server port: `process.env.PORT || 6001`
- Dev mode detection: `process.env.NODE_ENV === 'development'`
- JWT secret: `process.env.JWT_SECRET || 'dev-secret-change-in-production'`
- Azure AD config: `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`

**Hardcoded constants:**
- Color values: `#4573D2` (primary), `#6AAF50` (success), `#E8A442` (warning), `#D94F4F` (error)
- Layout: spacing `px-8 py-6`, card padding `p-6`, borders `rounded-xl` or `rounded-lg`
- Date/time: `SATURDAY = 6` (JavaScript getDay()), `SATURDAY = 0` (UTC ISO)

## Validation

**Backend (Zod):**
- All query/body parameters validated via Zod schemas in `src/middleware/validation.ts`
- Reusable schemas: `weekEndingQuery`, `dateRangeQuery`, `optionalDateRangeQuery`
- Custom validators: `isoDateString` regex check + date parse validation
- Middleware attaches parsed values to `req.validated` for type-safe access

**Frontend:**
- No form validation library; manual validation in component state
- CSV preview validation: type inference + conversion rules (currency, percentage, date normalization)
- Duplicate detection: check against existing database records per table unique key

## Asynchronous Patterns

**Frontend (React):**
- `useEffect` with cleanup for fetch operations
- Cancellation flag pattern to prevent state updates on unmounted components:
  ```typescript
  let cancelled = false;
  fetch(...).then(result => { if (!cancelled) setData(result); })
  return () => { cancelled = true; };
  ```
- Loading/error states before conditional rendering

**Backend (Express):**
- Async route handlers with `try-catch` → `next(err)` delegation
- Prisma queries are awaited; no promise chaining
- Middleware functions declared as `async` when they await (auth, permissions)

## Class vs. Function Approach

**Classes:**
- Used for services with static methods (no instantiation): `WeekService`, `FinancialService`, `AuthService`, `CsvParserService`
- Never instantiated directly; always called as `ServiceName.staticMethod()`

**Functions:**
- Middleware factories and React components are functions
- Event handlers are arrow functions within components

---

*Convention analysis: 2026-02-06*
