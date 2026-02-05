# Technology Stack

**Analysis Date:** 2026-02-06

## Languages

**Primary:**
- TypeScript 5.7-5.9 - Backend (`server/src/**/*.ts`), frontend (`client/src/**/*.ts`, `client/src/**/*.tsx`)
- JavaScript (ES2020+) - Module format (ESM) for both client and server

**Secondary:**
- CSS (via Tailwind CSS) - Styling through `client/src/**/*.tsx`

## Runtime

**Environment:**
- Node.js (no specific version pinned in package.json, but code targets ES2022)
- Browser (React 19.2.0 for client)

**Package Manager:**
- npm (workspace monorepo setup with `npm workspaces`)
- Lockfile: `package-lock.json` (likely present, standard npm behavior)

## Frameworks

**Core:**
- React 19.2.0 - Frontend UI (`client/src`)
- Express 4.21.2 - Backend HTTP server (`server/src/index.ts`)
- Prisma 6.3.0 - ORM for PostgreSQL database (`server/prisma/schema.prisma`)

**UI/Styling:**
- Tailwind CSS 4.1.18 - Utility-first CSS framework (`client/src/**/*.tsx`)
- @tailwindcss/vite 4.1.18 - Vite integration for Tailwind

**Charting:**
- Recharts 3.7.0 - React charts library for dashboard visualizations (`client/src/components/dashboard`)

**Build/Dev:**
- Vite 7.2.4 - Frontend dev server and build tool (`client/vite.config.ts`)
- tsx 4.19.2 - TypeScript execution for server dev (`server/package.json`)
- @vitejs/plugin-react 5.1.1 - Vite React plugin

**Testing/Linting:**
- ESLint 9.39.1 - Code linting (`client/eslint.config.js`)
- @typescript-eslint (parser 8.46.4, plugin 8.46.4) - TypeScript ESLint support
- eslint-plugin-react-hooks 7.0.1 - React Hooks linting
- eslint-plugin-react-refresh 0.4.24 - Fast Refresh support in Vite

## Key Dependencies

**Backend - Authentication & Auth:**
- @azure/msal-node 5.0.3 - Microsoft Entra ID (Azure AD) for M365 SSO (`server/src/services/AuthService.ts`)
- jsonwebtoken 9.0.3 - JWT token generation and verification (`server/src/services/AuthService.ts`)

**Backend - Data Processing:**
- papaparse 5.5.2 - CSV parsing library (`server/src/services/CsvParserService.ts`)
- multer 1.4.5-lts.1 - Multipart form data handling for file uploads (`server/src/routes/uploads.ts`)
- zod 3.24.1 - Schema validation and TypeScript type inference (`server/src/middleware/validation.ts`)

**Backend - Database:**
- @prisma/client 6.3.0 - Prisma ORM client for PostgreSQL operations

**Backend - Server:**
- cors 2.8.5 - Cross-origin resource sharing middleware
- dotenv 16.4.7 - Environment variable loading (`server/index.ts`)
- express 4.21.2 - HTTP framework and routing

**Development/Build:**
- @types/cors 2.8.17 - TypeScript types for CORS
- @types/express 5.0.0 - TypeScript types for Express
- @types/jsonwebtoken 9.0.10 - TypeScript types for JWT
- @types/multer 1.4.12 - TypeScript types for Multer
- @types/papaparse 5.3.15 - TypeScript types for PapaParse
- @types/react 19.2.5 - TypeScript types for React
- @types/react-dom 19.2.3 - TypeScript types for React DOM
- @types/node 24.10.1 - TypeScript types for Node.js
- concurrently 9.1.0 - Run multiple npm scripts in parallel (`npm run dev`)
- prisma 6.3.0 - Prisma CLI for migrations and schema management
- typescript 5.7.3-5.9.3 - TypeScript compiler

## Configuration

**Environment:**
- `.env` file at `server/.env` (runtime configuration)
- `.env.example` at project root documenting all required variables
- Configuration pattern: `process.env.VARIABLE_NAME` throughout codebase
- Key env vars:
  - `DATABASE_URL` - PostgreSQL connection string
  - `PORT` - Server port (defaults to 6001)
  - `NODE_ENV` - "development" for dev bypass auth, "production" for real auth
  - `JWT_SECRET` - Secret for signing/verifying JWTs
  - `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` - M365 SSO credentials
  - `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` - Xero API (Phase 1 scaffold, not yet implemented)
  - `DEV_USER_EMAIL`, `DEV_USER_NAME` - Dev auth bypass user details

**Build:**
- `client/vite.config.ts` - Vite build config with React plugin and Tailwind integration
- `client/tsconfig.json` - References `tsconfig.app.json` and `tsconfig.node.json`
- `server/tsconfig.json` - Targets ES2022, NodeNext module resolution
- `server/prisma.config.ts` - Prisma migration and schema config (auto-generated)
- `client/eslint.config.js` - Flat config format for ESLint with React and TypeScript rules

**Vite Dev Server:**
- Client dev: `http://localhost:6000` (proxies `/api/*` to `http://localhost:6001`)
- Server: `http://localhost:6001`

## Platform Requirements

**Development:**
- Node.js runtime (ES2022 compatible, typically 18.x or later)
- npm package manager
- PostgreSQL database (local or remote, URL via `DATABASE_URL`)
- Windows 11 (code is platform-agnostic, but `.bat` start/stop scripts used)

**Production:**
- Node.js runtime
- PostgreSQL database
- Environment variables configured for JWT, Azure AD (if using SSO), database connection
- Deployed as standalone process or container (no specific hosting platform locked in)

---

*Stack analysis: 2026-02-06*
