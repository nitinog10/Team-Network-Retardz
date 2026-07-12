# TransitOps — Full Implementation Plan

## Context

TransitOps is a role-based fleet operations platform (Odoo Hackathon 2026, team lead Nitin Mishra). The repo currently contains only `README.md` and `architecture.md`; this is a greenfield build. The first release must run fully locally: no external auth provider, no third-party API keys. DigiLocker licence verification is **mocked** behind an adapter interface so a real integration can be swapped in later.

Source of truth for domain rules: `architecture.md` (roles, status models, dispatch validation, maintenance workflow).

## Stack (decided)

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS + small reusable component set |
| Database | **MySQL 8 (locally installed)** via Prisma ORM |
| Auth | Custom credentials: bcrypt hashes, signed `httpOnly` session cookie (jose HS256), middleware guard |
| Validation | Zod schemas shared client/server |
| Charts | Recharts |
| Tests | Vitest for core logic only (dispatch validation, status transitions, RBAC) |

`DATABASE_URL="mysql://root:<password>@localhost:3306/transitops"` in `.env` (documented in `.env.example`, never committed with real values). Prisma migrations create the `transitops` database schema; README documents `CREATE DATABASE transitops;` as the one manual MySQL step.

## Project layout

```
src/
  app/
    (auth)/login/                      # public
    (app)/dashboard|vehicles|drivers|trips|maintenance|fuel|expenses|reports|admin/users/
    (app)/my-trips/                    # driver portal
    api/...                            # route handlers where needed (CSV export, mock verifier)
  lib/auth/        session.ts, password.ts, rbac.ts (role→permission map)
  lib/db.ts        Prisma client singleton
  lib/services/    trips.ts, maintenance.ts, verification/ (adapter + mock)
  lib/validation/  zod schemas per entity
  components/      shell, tables, forms, badges, charts, empty/loading/error states
prisma/            schema.prisma, migrations/, seed.ts
```

---

## Phase 0 — Foundation

- Scaffold Next.js + TS + Tailwind + ESLint/Prettier; strict tsconfig.
- App shell: sidebar (role-filtered later), top bar with user/role + logout, responsive content area; shared `Loading`, `Empty`, `ErrorState` components.
- `.env.example` (DATABASE_URL, SESSION_SECRET); env validated at boot with Zod.
- Scripts: `dev`, `build`, `lint`, `typecheck`, `db:migrate`, `db:seed`, `test`.
- README: MySQL setup (create DB, set URL), run steps, demo credentials table.

**Done when:** `npm run dev`, lint, typecheck, migrate, seed all work on a fresh clone with local MySQL.

## Phase 1 — Local authentication and RBAC

- Login page (email + password, Zod-validated), logout action.
- Session: signed JWT in `httpOnly` cookie, `sameSite=lax`, `secure` in prod, 7-day expiry; `getSession()` server helper returns `{userId, orgId, role}` or null.
- `middleware.ts` redirects unauthenticated users to `/login` for all `(app)` routes.
- `lib/auth/rbac.ts`: single `PERMISSIONS` map (role → allowed resources/actions). Server-side `requireRole()` / `can()` used in every server action and route handler — **role always derived from the session, never from the client**.
- Role-filtered navigation; forbidden direct API/action calls return 403.
- Admin → Users page: list, create, set role, enable/disable. Disabled users cannot log in and existing sessions are rejected (checked on each request via `active` flag).

Roles and access exactly as in `architecture.md` §2: Admin, Fleet Manager, Safety Manager, Financial Manager, Driver (own trips only).

**Done when:** every seeded user logs in, sees only their nav, and gets 403 calling a forbidden action directly.

## Phase 2 — Database schema and seed

Prisma schema with MySQL enums; every tenant table carries `organisationId` and **every query is scoped by it**.

Tables (fields per the ERD in the draft plan): `Organisation`, `User` (role enum, active, passwordHash), `Vehicle` (regNumber unique, type, maxLoadKg, odometerKm, acquisitionCost, region, status enum: AVAILABLE/ON_TRIP/IN_SHOP/RETIRED), `Driver` (optional userId link, licence number/category/expiry, safetyScore, status enum: AVAILABLE/ON_TRIP/OFF_DUTY/SUSPENDED, verificationStatus enum: UNVERIFIED/PENDING/VERIFIED/FAILED, verifiedAt), `Trip` (tripNumber, source/destination, vehicleId, driverId, cargoWeightKg, plannedDistanceKm, actualDistanceKm, finalOdometerKm, revenue, status enum: DRAFT/DISPATCHED/COMPLETED/CANCELLED, dispatchedAt/completedAt/cancelledAt), `MaintenanceLog` (status OPEN/CLOSED, cost), `FuelLog` (litres, cost, odometerKm, optional tripId), `Expense` (category enum, amount, optional tripId), `ActivityLog` (actor, entityType, entityId, action, JSON metadata).

Indexes: `(organisationId, status)` on vehicles/drivers/trips; unique `(organisationId, registrationNumber)`.

`prisma/seed.ts`: one demo org, one user per role (e.g. `admin@transitops.local` / `Demo@123` etc.), ~8 vehicles across statuses, ~6 drivers (one expired licence, one suspended), trips in every status, maintenance/fuel/expense history spanning ~3 months so charts have data.

## Phase 3 — Vehicle and Driver management

- **Vehicles** (Fleet Manager, Admin): list with status badges + filters (status, type, region), create/edit form, detail page (info, maintenance history, fuel history, cost summary), Retire action (blocked while ON_TRIP or IN_SHOP with open work).
- **Drivers** (Fleet Manager; Safety Manager for safety fields): list with licence-expiry and verification badges, create/edit, detail page. Safety Manager can set safety score, suspend/reinstate, toggle Off Duty. Optionally link a driver to a Driver-role user account for portal access.
- All writes go through server actions with Zod validation + RBAC + activity-log entry.

## Phase 4 — Trip workflow (core of the product)

`lib/services/trips.ts` holds all transition logic; UI never mutates status directly.

- **Draft**: Fleet Manager creates trip (source, destination, cargo weight, planned distance, revenue). Vehicle/driver pickers only show eligible candidates (available, licence valid+verified, capacity ≥ cargo) — but this is UX only.
- **Dispatch** — single `prisma.$transaction` that re-checks everything server-side:
  1. `SELECT ... FOR UPDATE` (via `$queryRaw`) on the vehicle and driver rows to prevent double-dispatch races.
  2. Validate: vehicle AVAILABLE, driver AVAILABLE + not suspended + licence not expired + VERIFIED, cargo ≤ maxLoadKg, both belong to the org.
  3. Set trip DISPATCHED, vehicle ON_TRIP, driver ON_TRIP, stamp `dispatchedAt`; write activity log. Any failure rolls back with a specific error message.
- **Complete** (Driver for own trip, or Fleet Manager): enter final odometer (≥ current vehicle odometer) and optional fuel entry; transaction sets trip COMPLETED, computes `actualDistanceKm = finalOdometer − vehicle.odometerKm`, updates vehicle odometer, frees vehicle and driver to AVAILABLE.
- **Cancel** (Fleet Manager): from DRAFT or DISPATCHED; frees resources if dispatched.
- Trip list with status filter; trip detail with timeline and linked fuel/expense records.
- **Driver portal** (`/my-trips`): driver-role user sees only trips where `trip.driver.userId = session.userId`; can start/complete own trip and enter odometer + fuel. Enforced in every query, not just UI.

**Vitest here:** dispatch validation matrix (each failing rule), double-dispatch race (two concurrent dispatches of same vehicle → one fails), completion odometer math, illegal status transitions rejected.

## Phase 5 — Maintenance

- Open log (Fleet Manager) → same transaction sets vehicle IN_SHOP (rejected if vehicle ON_TRIP).
- Vehicle excluded from dispatch pickers and dispatch validation while IN_SHOP.
- Close log with cost → vehicle back to AVAILABLE (unless RETIRED).
- List (open/closed filter) + per-vehicle history on vehicle detail page.

## Phase 6 — Fuel and expenses

- **Fuel logs** (Financial Manager, Fleet Manager; Driver via trip completion): litres, cost, odometer, optional trip link. Derived per-vehicle km/l shown on vehicle detail.
- **Expenses** (Financial Manager): category (FUEL/TOLL/REPAIR/PERMIT/OTHER), amount, date, optional vehicle/trip link, notes.
- Maintenance cost + fuel + expenses roll up into per-vehicle and per-trip operational cost used by reports.

## Phase 7 — Dashboard, reports, CSV export

- **Dashboard** (per-role KPI cards): fleet status breakdown, active trips, utilisation %, licence-expiry alerts (≤30 days), open maintenance, month cost vs revenue; recent-trips table; filters by region/type. Recharts for status donut + monthly cost/revenue bars.
- **Reports** (Financial Manager, Admin): vehicle utilisation, fuel efficiency per vehicle, cost per km, trip profitability (revenue − fuel − expenses − allocated maintenance), vehicle ROI vs acquisition cost. Date-range + region filters.
- **CSV export**: route handler per report, RBAC-guarded, streams CSV of the filtered dataset.

## Phase 8 — Licence verification (DigiLocker mocked)

- `lib/services/verification/adapter.ts`: `LicenceVerifier` interface (`verify(licenceNumber, name, dob) → {status, verifiedAt, details}`).
- `MockDigiLockerVerifier`: deterministic — licence numbers ending in an odd digit verify, even digits fail, configurable delay to look real; clearly labelled "Mock" in the UI.
- Safety Manager triggers verification from driver detail; result stored on driver (`verificationStatus`, `verifiedAt`) + activity log. Dispatch requires VERIFIED (already enforced in Phase 4).
- Swapping in real DigiLocker later = new adapter class + env flag; no other code changes.

## Cross-cutting

- **Activity log**: helper `logActivity()` called from every mutating service; Admin can view a filterable feed.
- **Security rules enforced everywhere**: role from session only; org scoping on every query; disabled users rejected; driver endpoints filtered to own record; server-side revalidation of all dispatch rules.

## Verification

1. Fresh clone → create MySQL DB → `npm i && npx prisma migrate dev && npm run db:seed && npm run dev`.
2. `npm run test` — dispatch/RBAC/transition suites green; `npm run lint && npm run typecheck` clean.
3. Manual role sweep with seeded accounts: each role sees only its nav; direct calls to forbidden server actions return 403; driver account sees only own trips.
4. End-to-end happy path: create draft → dispatch (vehicle+driver flip to On Trip) → complete with odometer+fuel → both freed, dashboard and reports reflect the trip.
5. Negative checks: dispatch with expired-licence driver, over-capacity cargo, or IN_SHOP vehicle → clear error, nothing changes; open maintenance on ON_TRIP vehicle → rejected; disabled user login → rejected.
6. Mock verification: verify one driver (succeeds), one with even-ending licence (fails), confirm dispatch gating.

## Suggested execution order

Phases 0→2 first (foundation, auth, schema+seed), then 4 (trips) as the critical path, then 3/5/6 (masters, maintenance, money), then 7 (analytics), then 8 (verification mock) — though 8's schema fields exist from Phase 2 so dispatch gating works from day one (seed marks most drivers VERIFIED).
