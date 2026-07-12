# TransitOps — Implementation Checklist

Tracks progress against [plan.md](plan.md). Last updated: **2026-07-12** (Phases 0–2 done).

## Phase 0 — Foundation ✅

- [x] Backend scaffold: Express 5 + TypeScript, strict tsconfig (`backend/`)
- [x] Frontend scaffold: Vite + React 19 + TS + Tailwind 4 (`frontend/`)
- [x] Vite proxy `/api` → `http://localhost:4000` (same-origin cookies)
- [x] `.env.example` (DATABASE_URL, SESSION_SECRET, PORT); env validated at boot with Zod (`backend/src/config/env.ts`)
- [x] Scripts: `dev`, `build`, `typecheck`, `db:migrate`, `db:seed`, `test`
- [x] README: MySQL setup, run steps, demo credentials table
- [x] App shell: sidebar (role-filtered), top bar with user/role + logout
- [ ] Shared `Loading` / `Empty` / `ErrorState` components (inline for now, extract when pages multiply)
- [ ] ESLint/Prettier for backend (frontend has oxlint)

## Phase 1 — Local authentication and RBAC ✅

- [x] Login page wired to API (email + password, error states)
- [x] Session: signed JWT (jose HS256) in `httpOnly` cookie, `sameSite=lax`, `secure` in prod, 7-day expiry
- [x] `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`
- [x] `requireAuth` middleware — verifies JWT **and** re-checks `active` in DB each request
- [x] `PERMISSIONS` map + `requirePermission(resource, action)` — role from session only (`backend/src/lib/auth/rbac.ts`)
- [x] Role-filtered navigation; unauthenticated users see only login
- [x] Admin → Users page: list, create, set role, enable/disable (self-disable blocked)
- [x] Forbidden API calls return 403 (verified: driver → `/api/users`)
- [x] RBAC unit tests (7 passing, Vitest)

## Phase 2 — Database schema and seed ✅

- [x] Prisma schema, all tables: Organisation, User, Vehicle, Driver, Trip, MaintenanceLog, FuelLog, Expense, ActivityLog
- [x] MySQL enums: roles, vehicle/driver/trip/maintenance statuses, verification status, expense category
- [x] `organisationId` on every tenant table; `(organisationId, status)` indexes; unique `(organisationId, registrationNumber)`
- [x] Initial migration applied (`prisma/migrations/20260712071428_init`)
- [x] Seed: demo org, one user per role (`Demo@123`), 8 vehicles, 6 drivers (one expired licence, one suspended, one unverified), trips in every status, ~3 months of maintenance/fuel/expense history
- [x] `logActivity()` helper (`backend/src/services/activity.ts`) — used by user routes; wire into every future mutating service

## Phase 3 — Vehicle and Driver management ✅

- [x] Vehicles API: list (filters: status/type/region), create, edit, detail
- [x] Vehicle Retire action (blocked while ON_TRIP or IN_SHOP with open work)
- [x] Drivers API: list, create, edit, detail; licence-expiry + verification badges
- [x] Safety Manager: set safety score, suspend/reinstate, toggle Off Duty
- [x] Link driver to Driver-role user account
- [x] Frontend pages: vehicle list/form/detail, driver list/form/detail
- [x] Zod validation + RBAC + activity log on all writes

## Phase 4 — Trip workflow (critical path) ✅

- [x] `services/trips.ts` — all status transitions server-side only
- [x] Draft: create trip; eligible-only vehicle/driver pickers (UX)
- [x] Dispatch: single transaction, `SELECT ... FOR UPDATE` locks, full server-side revalidation (vehicle AVAILABLE, driver AVAILABLE + verified + licence valid, cargo ≤ maxLoadKg, org match)
- [x] Complete: final odometer ≥ current, compute `actualDistanceKm`, update vehicle odometer, free vehicle + driver
- [x] Cancel: from DRAFT or DISPATCHED, frees resources
- [x] Trip list + detail (timeline, linked fuel/expenses)
- [x] Driver portal `/my-trips` — scoped to `trip.driver.userId = session.userId` in every query
- [x] Vitest: dispatch validation matrix, double-dispatch race, odometer math, illegal transitions

## Phase 5 — Maintenance ✅

- [x] Open log → vehicle IN_SHOP (rejected if ON_TRIP), close with cost → back to AVAILABLE
- [x] IN_SHOP vehicles excluded from dispatch
- [x] List with open/closed filter + per-vehicle history

## Phase 6 — Fuel and expenses ✅

- [x] Fuel logs (litres, cost, odometer, optional trip); per-vehicle km/l
- [x] Expenses (category, amount, optional vehicle/trip link)
- [x] Cost roll-ups per vehicle and per trip

## Phase 7 — Dashboard, reports, CSV export ⬜

- [ ] Role-aware KPI cards (fleet status, active trips, utilisation, licence alerts ≤30d, open maintenance, cost vs revenue) — placeholder tiles exist
- [ ] Recharts: status donut + monthly cost/revenue bars
- [ ] Reports: utilisation, fuel efficiency, cost/km, trip profitability, ROI; date-range + region filters
- [ ] CSV export endpoints (RBAC-guarded)

## Phase 8 — Licence verification (DigiLocker mock) ⬜

- [ ] `LicenceVerifier` adapter interface + `MockDigiLockerVerifier` (odd-ending licence → verified)
- [ ] Safety Manager triggers verification from driver detail; result + activity log
- [ ] Dispatch requires VERIFIED (schema fields already in place from Phase 2)

## Cross-cutting

- [x] Org scoping on every query (users routes; keep enforcing in all new routes)
- [x] Disabled users rejected on login **and** on existing sessions
- [x] Activity log helper
- [ ] Admin activity-log feed page
- [ ] Driver endpoints filtered to own record (comes with Phase 4)

## Local environment note

Dev DB is a **portable MySQL 8.0.40** in `.local/` (gitignored — machine's MySQL80 service is broken). Start with `.local/start-mysql.cmd`; root has no password. Teammates need their own MySQL 8 + `CREATE DATABASE transitops;`.
