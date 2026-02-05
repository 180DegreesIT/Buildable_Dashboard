# Testing Patterns

**Analysis Date:** 2026-02-06

## Test Framework

**Status:** No testing framework configured.

**Runner:**
- Not installed. Jest, Vitest, or similar are not in dependencies.

**Assertion Library:**
- Not applicable (no test framework present).

**Run Commands:**
- No test scripts in `package.json`
- No test files present in the codebase (searched `**/*.test.*` and `**/*.spec.*`)

## Test File Organization

**Current State:**
- No test files exist in the codebase
- No test directories created (`/tests`, `/__tests__`, etc.)
- No test configuration files (`jest.config.js`, `vitest.config.ts`, etc.)

## Recommended Test Structure (if adopted)

**Proposed Location:**
- Co-located pattern: test files adjacent to source files
  - Frontend: `src/components/ui/__tests__/KPICard.test.tsx`
  - Backend: `src/services/__tests__/WeekService.test.ts`
- Alternatively: dedicated `tests/` directory mirroring `src/` structure

**Naming:**
- `*.test.ts` (preferred) or `*.spec.ts` suffix
- Match source filename: `KPICard.tsx` → `KPICard.test.tsx`

**Structure Pattern (when implemented):**
```
src/
├── components/
│   ├── __tests__/
│   │   └── KPICard.test.tsx
│   └── KPICard.tsx
├── services/
│   ├── __tests__/
│   │   └── WeekService.test.ts
│   └── WeekService.ts
```

## Suggested Test Coverage Priority

**High Priority (critical business logic):**

1. **`src/services/WeekService.ts`** - Date snapping logic
   - `toSaturday()`: Snap dates within ±3 days to nearest Saturday
   - `validateWeekEnding()`: Validation + correction logic
   - Edge cases: leap years, month boundaries, exact Saturdays

2. **`src/services/FinancialService.ts`** - Financial calculations
   - `computeDerivedMetrics()`: gross profit margin, profit percentage, revenue-to-staff ratio
   - Division by zero protection
   - Decimal precision (2 decimal places on currency)

3. **`src/services/CsvParserService.ts`** - CSV import validation
   - `parseCsv()`: BOM stripping, delimiter detection, header parsing
   - Type inference: date, currency, integer, decimal, percentage, text
   - Row validation: date auto-correction, currency formatting, blank row skipping
   - Unicode and encoding handling

4. **`src/services/ImportService.ts`** - Data import logic
   - `importRows()`: Duplicate detection, overwrite/skip/merge strategies
   - Transaction rollback data structure
   - Unique key resolution per table

5. **`src/services/TargetService.ts`** - Target resolution
   - `resolveTarget()`: Effective date range matching for targets

**Medium Priority (UI/UX):**

1. **Frontend API layer (`src/lib/api.ts`)**
   - Response error extraction
   - Generic fetch wrapper behavior
   - Request serialization

2. **React hooks (`src/lib/WeekContext.tsx`)**
   - Week initialization and selection
   - Fallback to current Saturday
   - Provider integration with component tree

3. **Components**
   - `ExecutiveSummary.tsx`: Data loading, error handling, empty state
   - `KPICard.tsx`: Variance color logic, benchmark visualization
   - `DataTable.tsx`: Sorting, rendering, expandable rows

**Lower Priority (UI components with simple state):**
- Layout components: `Sidebar.tsx`, `TopBar.tsx`
- Presentational components: `EmptyState.tsx`, `LoadingSkeleton.tsx`
- Form components: `ColumnMapper.tsx`, `PreviewValidate.tsx` (complex state; consider integration tests instead)

## Suggested Testing Tools

**If implementing tests:**

### Frontend
- Framework: **Vitest** (fast, ESM-native, minimal config needed with Vite)
- Component testing: **Testing Library** (React + user-centric assertions)
- Mocking: **Vitest** built-in mocking + MSW (Mock Service Worker) for API mocks

### Backend
- Framework: **Vitest** or **Jest** (both work with Node.js + TypeScript)
- Database: **Prisma test utilities** or **Docker containers** for PostgreSQL
- Mocking: **Vitest mocking** or **Jest mocks**

### Configuration Example (Vitest)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',  // for React components
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

## Current Code Patterns That Facilitate Testing

**Positive practices already in place:**

1. **Dependency injection via imports**
   - Services use Prisma injected via `import prisma from '../db.js'`
   - Can be mocked by replacing module: `vi.mock('../db.js')`

2. **Pure utility functions**
   - `WeekService.toSaturday()` is pure (no side effects)
   - `FinancialService.computeDerivedMetrics()` is pure (no DB calls)
   - Easy to unit test with assertion-only tests

3. **Type-safe parameters**
   - Services have strongly-typed method signatures
   - Type checks catch issues early

4. **Separation of concerns**
   - Route handlers delegate business logic to services
   - Services delegate data access to Prisma
   - Clear boundaries for mocking

5. **No global state** (outside React Context)
   - Services are stateless
   - No module-level side effects (except `.config()`)

**Challenges:**

1. **Prisma database calls embedded in services**
   - Mock Prisma client for unit tests: `vi.mock('@prisma/client')`
   - Or use integration tests with test database

2. **Express route testing requires app setup**
   - Create test app instance in setup
   - Or use `supertest` for HTTP-level testing

3. **React Context subscription in components**
   - Wrap test components with `WeekProvider`
   - Mock the context if testing in isolation

## Async Testing Recommendations

**Pattern already used in frontend (no test framework yet):**
```typescript
useEffect(() => {
  let cancelled = false;
  fetchData().then(result => {
    if (!cancelled) setData(result);
  });
  return () => { cancelled = true; };
}, []);
```

**For tests, use `async`/`await` syntax:**
```typescript
it('loads data on mount', async () => {
  render(<ExecutiveSummary />);
  await waitFor(() => expect(screen.getByText(/revenue/i)).toBeInTheDocument());
})
```

**For Vitest:**
```typescript
vi.mock('../lib/dashboardApi.ts', () => ({
  fetchExecutiveSummary: vi.fn().mockResolvedValue({
    hasData: true,
    summary: { ... }
  })
}))
```

## Error Testing Recommendations

**Backend route error testing:**
```typescript
it('returns 400 on invalid date format', async () => {
  const res = await supertest(app)
    .get('/api/v1/financial/weekly?weekEnding=invalid')
  expect(res.status).toBe(400)
  expect(res.body.error.message).toContain('Validation error')
})
```

**Service error handling:**
```typescript
it('throws ApiError.notFound when no data exists', async () => {
  vi.mocked(prisma.financialWeekly.findUnique).mockResolvedValue(null)
  await expect(FinancialService.getWeeklySummary(...))
    .rejects.toThrow('No financial data')
})
```

**Frontend component error display:**
```typescript
it('shows error message on fetch failure', async () => {
  vi.mock('../lib/dashboardApi.ts', () => ({
    fetchExecutiveSummary: vi.fn().mockRejectedValue(new Error('Server error'))
  }))
  render(<ExecutiveSummary />)
  await waitFor(() => expect(screen.getByText(/error loading/i)).toBeInTheDocument())
})
```

## Critical Paths for Testing

**CSV Import Workflow (most critical feature per CLAUDE.md):**

1. **End-to-end test:**
   - Upload sample CSV
   - Auto-map or manual map columns
   - Validate rows
   - Import with strategy (overwrite/skip/merge)
   - Verify database state

2. **Unit tests for each step:**
   - `CsvParserService.parseCsv()`: Parse + type inference
   - `CsvParserService.validateRows()`: Validation logic
   - `DataTypeRegistry.getById()`: Lookup data type definition
   - `ImportService.importRows()`: Execute import with strategy
   - `ImportService.rollbackUpload()`: Verify rollback state

**Financial Calculations:**

1. Unit tests for all derived metrics:
   - Gross profit margin = (GP / Income) × 100
   - Profit percentage = (NP / Income) × 100
   - Revenue to staff ratio = (Wages / Income) × 100
   - Edge case: zero income → all metrics = 0

2. Integration test: Fetch week → Apply calculation → Assert output

**Date Handling:**

1. Unit tests for week snapping:
   - Monday–Sunday → snap to nearest Saturday (±3 day window)
   - Exact Saturday → unchanged
   - Out of range (>3 days) → error
   - Month/year boundaries: Jan 1, Dec 31, leap year dates

2. Integration: Import CSV with various date formats → auto-correct to Saturday

## Mocking Strategies

**Prisma Client:**
```typescript
vi.mock('../db.js', () => ({
  default: {
    user: { findUnique: vi.fn(), upsert: vi.fn() },
    financialWeekly: { findUnique: vi.fn(), findMany: vi.fn() },
    // ... other models
  }
}))
```

**Fetch/API calls (frontend):**
```typescript
global.fetch = vi.fn()
vi.mocked(global.fetch).mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({ ... })
})
```

**Or use MSW (Mock Service Worker) for HTTP-level mocking:**
```typescript
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('/api/v1/weeks/current', () => {
    return HttpResponse.json({ currentWeekEnding: '2026-02-01' })
  })
)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
```

**Azure AD / MSAL:**
```typescript
vi.mock('@azure/msal-node', () => ({
  ConfidentialClientApplication: vi.fn(() => ({
    getAuthCodeUrl: vi.fn(),
    acquireTokenByCode: vi.fn()
  }))
}))
```

## Performance Testing Recommendations

Per CLAUDE.md: "Executive Summary loads in under 2 seconds."

**Suggested test:**
```typescript
it('ExecutiveSummary loads in < 2 seconds', async () => {
  const start = performance.now()
  render(<ExecutiveSummary />)
  await waitFor(() => expect(screen.getByText(/revenue/i)).toBeInTheDocument())
  const duration = performance.now() - start
  expect(duration).toBeLessThan(2000)
})
```

## Test Data & Fixtures

**Not yet implemented; recommendations:**

1. **Database seeding:**
   - Extend `src/seed.ts` with test data generation
   - Or use factory functions: `createTestUser()`, `createTestWeek()`, `createTestFinancialData()`

2. **Sample CSVs for import testing:**
   - Create fixture files: `tests/fixtures/financial_upload.csv`, `leads_upload.csv`
   - Cover all 15+ importable data types

3. **Mock response data:**
   - Define constants for API responses used in multiple tests
   - Example: `MOCK_EXECUTIVE_SUMMARY`, `MOCK_FINANCIAL_WEEK`

---

*Testing analysis: 2026-02-06*

**Note:** No testing framework is currently integrated. These recommendations outline best practices and tool selection if testing is adopted in future phases.
