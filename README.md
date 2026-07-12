<p align="center">
  <img src="https://img.shields.io/badge/Hackathon-Odoo%202026-7C3AED?style=for-the-badge" alt="Odoo Hackathon 2026" />
  <img src="https://img.shields.io/badge/Team-Network%20Retardz-0EA5E9?style=for-the-badge" alt="Team Network Retardz" />
  <img src="https://img.shields.io/badge/Status-Production%20Ready-10B981?style=for-the-badge" alt="Status" />
</p>

<h1 align="center">🚛 TransitOps</h1>

<p align="center">
  <strong>A role-based fleet operations management platform built for the Odoo Hackathon 2026</strong>
  <br/>
  <em>End-to-end fleet management — from vehicle dispatch to financial analytics — with granular role-based access control.</em>
</p>

---

## 📖 Table of Contents

- [Problem Statement](#-problem-statement)
- [Our Solution](#-our-solution)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Database Schema](#-database-schema)
- [Role-Based Access Control](#-role-based-access-control)
- [Application Workflow](#-application-workflow)
- [API Reference](#-api-reference)
- [Getting Started](#-getting-started)
- [Demo Credentials](#-demo-credentials)
- [Project Structure](#-project-structure)
- [Testing](#-testing)
- [Team](#-team)

---

## 🎯 Problem Statement

Fleet and logistics companies in India face critical operational challenges:

- **Fragmented operations** — Vehicle tracking, driver management, trip planning, and financial reporting are handled in disconnected spreadsheets or siloed tools
- **No role-based access** — Everyone sees everything, leading to data exposure and accidental modifications
- **Manual dispatch validation** — Dispatchers must manually verify driver licences, vehicle availability, load capacity, and safety compliance before every trip
- **Zero financial visibility** — Operating costs (fuel, tolls, maintenance) are not tied back to individual trips or vehicles, making profitability analysis impossible
- **Compliance gaps** — Expired licences, unverified drivers, and overdue maintenance slip through the cracks

## 💡 Our Solution

**TransitOps** is a full-stack, role-based fleet operations platform that unifies the entire logistics workflow into a single, secure dashboard. Each user — from admin to driver — sees only what they need and can do only what their role permits.

### What makes TransitOps different?

| Problem | TransitOps Solution |
|---|---|
| Fragmented tools | Single platform covering vehicles, drivers, trips, maintenance, fuel, and expenses |
| No access control | 5-role RBAC system with server-enforced permissions on every API call |
| Manual dispatch checks | Automated server-side validation — licence expiry, verification status, vehicle availability, load capacity — all checked atomically in a single transaction |
| Financial blind spots | Per-trip and per-vehicle cost roll-ups with revenue vs. cost analytics |
| Compliance gaps | Licence expiry alerts, driver verification workflow (DigiLocker-ready), safety scoring |

---

## ✨ Key Features

### 🔐 Authentication & Authorization
- Secure local authentication with bcrypt-hashed passwords
- JWT session tokens in `httpOnly` cookies (no localStorage exposure)
- 5 distinct roles with granular, server-enforced permissions
- Disabled accounts rejected on both login and existing sessions

### 🚚 Vehicle Management
- Full CRUD with status lifecycle: `AVAILABLE` → `ON_TRIP` → `IN_SHOP` → `RETIRED`
- Filter by status, type, and region
- Vehicle retirement safeguards (blocked while on trip or in maintenance)
- Odometer tracking with automatic updates on trip completion

### 👨‍✈️ Driver Management
- Driver profiles with licence details, safety scores, and verification status
- Link driver records to user accounts for portal access
- Safety Manager controls: suspend/reinstate, update safety scores, toggle off-duty
- Licence expiry tracking with dashboard alerts (≤ 30 days)

### 🗺️ Trip Workflow (Core Feature)
- **Draft** → **Dispatch** → **Complete** / **Cancel** state machine
- **Atomic dispatch validation** in a single database transaction:
  - `SELECT ... FOR UPDATE` row locks prevent double-dispatch races
  - Server verifies: vehicle available, driver available + verified + licence valid, cargo ≤ capacity
- Trip completion: final odometer entry, automatic distance calculation, resource release
- Driver portal: drivers see only their own assigned trips

### 🔧 Maintenance
- Open maintenance log → vehicle automatically moves to `IN_SHOP`
- `IN_SHOP` vehicles excluded from dispatch (both UI pickers and server validation)
- Close with cost → vehicle returns to `AVAILABLE`

### ⛽ Fuel & Expense Tracking
- Fuel logs with litres, cost, odometer, and optional trip linking
- Per-vehicle fuel efficiency (km/L) calculations
- Categorised expenses: Fuel, Toll, Repair, Permit, Other
- Cost roll-ups per vehicle and per trip for profitability analysis

### 📊 Dashboard & Analytics
- Role-aware KPI cards (fleet utilisation, active trips, revenue vs cost, licence alerts)
- Interactive charts powered by Recharts (fleet status donut, monthly revenue/cost bars)
- Recent trips feed with status indicators

### ✅ Licence Verification (DigiLocker Mock)
- Adapter pattern: plug in real DigiLocker API without code changes
- Mock verifier: deterministic results based on licence number
- Dispatch requires `VERIFIED` status — enforced server-side

### 📋 Activity Log & Audit Trail
- Every mutation (create, update, status change) is logged with actor, entity, and metadata
- Admin-only audit feed with entity-type filtering
- Full traceability for compliance

### 🔔 Notifications
- In-app notification bell with unread count
- Trip-related notifications for drivers
- Mark individual or all as read

---

## 🛠 Tech Stack

```mermaid
graph LR
    subgraph Frontend
        A[React 19] --> B[Vite 8]
        A --> C[Tailwind CSS 4]
        A --> D[Recharts]
        A --> E[TypeScript 6]
    end

    subgraph Backend
        F[Express 5] --> G[Prisma ORM]
        F --> H[Zod Validation]
        F --> I[Jose JWT]
        F --> J[bcryptjs]
        F --> K[TypeScript 5]
    end

    subgraph Database
        L[(MySQL 8)]
    end

    subgraph Testing
        M[Vitest]
    end

    B -->|proxy /api| F
    G --> L
    M --> F
```

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19 + TypeScript | Component-based SPA with type safety |
| **Bundler** | Vite 8 | Lightning-fast HMR, dev proxy to backend |
| **Styling** | Tailwind CSS 4 | Utility-first CSS framework |
| **Charts** | Recharts | Interactive, responsive data visualisations |
| **Backend** | Express 5 + TypeScript | RESTful API server |
| **ORM** | Prisma 6 | Type-safe database client with migrations |
| **Auth** | Jose (HS256 JWT) + bcryptjs | Stateless sessions in httpOnly cookies |
| **Validation** | Zod | Runtime schema validation on all inputs |
| **Database** | MySQL 8 | Relational database with enum support |
| **Testing** | Vitest | Unit tests for dispatch logic, RBAC, and transitions |
| **Linting** | oxlint | Fast frontend linting |

---

## 🏗 System Architecture

```mermaid
graph TB
    subgraph Client["Browser (localhost:5173)"]
        UI[React SPA]
    end

    subgraph ViteProxy["Vite Dev Server"]
        PROXY["/api → :4000 proxy"]
    end

    subgraph Server["Express API (localhost:4000)"]
        MW[Middleware Layer]
        ROUTES[Route Handlers]
        SVC[Service Layer]
        VAL[Zod Validation]
    end

    subgraph DB["MySQL 8 (:3306)"]
        PRISMA[(Prisma ORM)]
    end

    UI -->|"Same-origin requests"| PROXY
    PROXY -->|"HTTP proxy"| MW
    MW -->|"Auth + RBAC"| ROUTES
    ROUTES -->|"Validated input"| SVC
    SVC --> VAL
    SVC -->|"Queries/Transactions"| PRISMA

    MW -.-|"JWT cookie\n(httpOnly, sameSite=lax)"| UI
```

### Architectural Decisions

1. **Monorepo with separate frontend/backend** — Clean separation of concerns; Vite proxies `/api` to Express for same-origin cookie auth (no CORS complexity)
2. **Server-side RBAC** — Role is derived from the JWT session, never from the client. Every API endpoint checks permissions before executing
3. **Organisation scoping** — Every database query is scoped by `organisationId`, enforcing multi-tenant data isolation even though the hackathon uses a single org
4. **Transactional dispatch** — Trip dispatch uses `SELECT ... FOR UPDATE` row locks inside a `$transaction` to prevent race conditions (e.g., two dispatchers assigning the same vehicle simultaneously)
5. **Adapter pattern for verification** — DigiLocker integration is behind an interface; swapping mock → real requires only a new adapter class

---

## 🗄 Database Schema

```mermaid
erDiagram
    Organisation ||--o{ User : has
    Organisation ||--o{ Vehicle : owns
    Organisation ||--o{ Driver : employs
    Organisation ||--o{ Trip : manages
    Organisation ||--o{ MaintenanceLog : tracks
    Organisation ||--o{ FuelLog : records
    Organisation ||--o{ Expense : records
    Organisation ||--o{ ActivityLog : audits

    User ||--o| Driver : "linked (optional)"
    User ||--o{ ActivityLog : performs
    User ||--o{ Notification : receives

    Vehicle ||--o{ Trip : assigned
    Vehicle ||--o{ MaintenanceLog : serviced
    Vehicle ||--o{ FuelLog : fuelled
    Vehicle ||--o{ Expense : incurs

    Driver ||--o{ Trip : drives

    Trip ||--o{ FuelLog : generates
    Trip ||--o{ Expense : incurs
    Trip ||--o{ Notification : triggers

    Organisation {
        string id PK
        string name
        datetime createdAt
    }

    User {
        string id PK
        string organisationId FK
        string email UK
        string name
        string passwordHash
        enum role
        boolean active
    }

    Vehicle {
        string id PK
        string organisationId FK
        string registrationNumber UK
        string type
        int maxLoadKg
        int odometerKm
        decimal acquisitionCost
        string region
        enum status
    }

    Driver {
        string id PK
        string organisationId FK
        string userId FK
        string name
        string licenceNumber
        string licenceCategory
        datetime licenceExpiry
        int safetyScore
        enum status
        enum verificationStatus
        datetime verifiedAt
    }

    Trip {
        string id PK
        string organisationId FK
        string tripNumber UK
        string source
        string destination
        string vehicleId FK
        string driverId FK
        int cargoWeightKg
        int plannedDistanceKm
        int actualDistanceKm
        decimal revenue
        enum status
    }

    MaintenanceLog {
        string id PK
        string organisationId FK
        string vehicleId FK
        string description
        enum status
        decimal cost
        datetime openedAt
        datetime closedAt
    }

    FuelLog {
        string id PK
        string organisationId FK
        string vehicleId FK
        string tripId FK
        decimal litres
        decimal cost
        int odometerKm
        datetime loggedAt
    }

    Expense {
        string id PK
        string organisationId FK
        string vehicleId FK
        string tripId FK
        enum category
        decimal amount
        string notes
        datetime incurredAt
    }

    ActivityLog {
        string id PK
        string organisationId FK
        string actorId FK
        string entityType
        string entityId
        string action
        json metadata
        datetime createdAt
    }

    Notification {
        string id PK
        string userId FK
        string title
        string message
        boolean read
        string tripId FK
        datetime createdAt
    }
```

### Enums

| Enum | Values |
|---|---|
| **Role** | `ADMIN` · `FLEET_MANAGER` · `SAFETY_MANAGER` · `FINANCIAL_MANAGER` · `DRIVER` |
| **VehicleStatus** | `AVAILABLE` · `ON_TRIP` · `IN_SHOP` · `RETIRED` |
| **DriverStatus** | `AVAILABLE` · `ON_TRIP` · `OFF_DUTY` · `SUSPENDED` |
| **VerificationStatus** | `UNVERIFIED` · `PENDING` · `VERIFIED` · `FAILED` |
| **TripStatus** | `DRAFT` · `DISPATCHED` · `COMPLETED` · `CANCELLED` |
| **MaintenanceStatus** | `OPEN` · `CLOSED` |
| **ExpenseCategory** | `FUEL` · `TOLL` · `REPAIR` · `PERMIT` · `OTHER` |

---

## 🔒 Role-Based Access Control

Every API endpoint enforces RBAC server-side. The role is derived from the JWT session — never from client input.

| Feature | Admin | Fleet Manager | Safety Manager | Financial Manager | Driver |
|---|:---:|:---:|:---:|:---:|:---:|
| **Dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Vehicles** (CRUD) | ✅ | ✅ | ❌ | Read only | ❌ |
| **Drivers** (CRUD) | ✅ | ✅ | Safety fields | ❌ | ❌ |
| **Trips** (all) | ✅ | ✅ | Read only | Read only | ❌ |
| **My Trips** (own) | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Maintenance** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Fuel & Expenses** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Activity Log** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **User Management** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Verify Driver** | ❌ | ❌ | ✅ | ❌ | ❌ |

---

## 🔄 Application Workflow

### Trip Lifecycle — State Machine

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Fleet Manager\ncreates trip

    DRAFT --> DISPATCHED: Dispatch\n(atomic validation)
    DRAFT --> CANCELLED: Cancel

    DISPATCHED --> COMPLETED: Complete\n(enter final odometer)
    DISPATCHED --> CANCELLED: Cancel\n(frees resources)

    COMPLETED --> [*]
    CANCELLED --> [*]

    note right of DISPATCHED
        On dispatch:
        • Vehicle → ON_TRIP
        • Driver → ON_TRIP
        • Row locks prevent races
    end note

    note right of COMPLETED
        On complete:
        • Calculate actual distance
        • Update vehicle odometer
        • Vehicle → AVAILABLE
        • Driver → AVAILABLE
    end note

    note right of CANCELLED
        On cancel (from dispatched):
        • Vehicle → AVAILABLE
        • Driver → AVAILABLE
    end note
```

### Vehicle Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> AVAILABLE: Vehicle created

    AVAILABLE --> ON_TRIP: Trip dispatched
    AVAILABLE --> IN_SHOP: Maintenance opened
    AVAILABLE --> RETIRED: Retire action

    ON_TRIP --> AVAILABLE: Trip completed/cancelled

    IN_SHOP --> AVAILABLE: Maintenance closed

    RETIRED --> [*]

    note right of ON_TRIP
        Cannot retire or
        open maintenance
        while ON_TRIP
    end note
```

### Dispatch Validation Flow

```mermaid
flowchart TD
    A[Fleet Manager clicks Dispatch] --> B{Vehicle AVAILABLE?}
    B -->|No| FAIL[❌ Rejected with reason]
    B -->|Yes| C{Driver AVAILABLE?}
    C -->|No| FAIL
    C -->|Yes| D{Driver not SUSPENDED?}
    D -->|No| FAIL
    D -->|Yes| E{Licence not expired?}
    E -->|No| FAIL
    E -->|Yes| F{Driver VERIFIED?}
    F -->|No| FAIL
    F -->|Yes| G{Cargo ≤ maxLoadKg?}
    G -->|No| FAIL
    G -->|Yes| H{Same organisation?}
    H -->|No| FAIL
    H -->|Yes| LOCK["🔒 Row lock (SELECT FOR UPDATE)"]
    LOCK --> TX["Transaction: Update statuses"]
    TX --> SUCCESS[✅ Trip dispatched]
```

---

## 📡 API Reference

All endpoints are prefixed with `/api` and require authentication unless noted.

### Authentication
| Method | Endpoint | Description | Auth |
|---|---|---|:---:|
| `POST` | `/api/auth/login` | Login with email + password | ❌ |
| `POST` | `/api/auth/logout` | Clear session cookie | ✅ |
| `GET` | `/api/auth/me` | Get current user | ✅ |

### Users (Admin only)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | List all users |
| `POST` | `/api/users` | Create user |
| `PATCH` | `/api/users/:id` | Update role/active/name |

### Vehicles
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/vehicles` | List (filters: status, type, region) |
| `GET` | `/api/vehicles/available` | Available vehicles for dispatch |
| `GET` | `/api/vehicles/:id` | Vehicle detail |
| `POST` | `/api/vehicles` | Create vehicle |
| `PATCH` | `/api/vehicles/:id` | Update vehicle |
| `POST` | `/api/vehicles/:id/retire` | Retire vehicle |

### Drivers
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/drivers` | List (filters: status, verificationStatus) |
| `GET` | `/api/drivers/available` | Available drivers for dispatch |
| `GET` | `/api/drivers/:id` | Driver detail |
| `POST` | `/api/drivers` | Create driver |
| `PATCH` | `/api/drivers/:id` | Update driver |
| `PATCH` | `/api/drivers/:id/safety` | Update safety score/status |

### Trips
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/trips` | List (filter: status) |
| `GET` | `/api/trips/:id` | Trip detail |
| `POST` | `/api/trips` | Create draft trip |
| `POST` | `/api/trips/:id/dispatch` | Dispatch trip (atomic) |
| `POST` | `/api/trips/:id/complete` | Complete trip |
| `POST` | `/api/trips/:id/cancel` | Cancel trip |

### Maintenance
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/maintenance` | List (filters: status, vehicleId) |
| `POST` | `/api/maintenance` | Open maintenance log |
| `POST` | `/api/maintenance/:id/close` | Close with cost |

### Fuel & Expenses
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/fuel` | List fuel logs |
| `POST` | `/api/fuel` | Create fuel log |
| `GET` | `/api/fuel/efficiency` | Per-vehicle fuel efficiency |
| `GET` | `/api/expenses` | List expenses |
| `POST` | `/api/expenses` | Create expense |
| `GET` | `/api/expenses/vehicle-costs` | Cost roll-up per vehicle |
| `GET` | `/api/expenses/trip-costs` | Cost + profit per trip |

### Dashboard & Reports
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/stats` | KPI cards data |
| `GET` | `/api/dashboard/monthly` | Monthly revenue/cost |

### Other
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/verification/:driverId/verify` | Trigger licence verification |
| `GET` | `/api/activity` | Audit log (filter: entityType) |
| `GET` | `/api/notifications` | User notifications |
| `POST` | `/api/notifications/:id/read` | Mark notification read |
| `POST` | `/api/notifications/read-all` | Mark all read |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **MySQL** 8.x running on `localhost:3306`
- **npm** (comes with Node.js)

### 1. Clone and Install

```bash
git clone https://github.com/nitinog10/Team-Network-Retardz.git
cd Team-Network-Retardz
```

Install dependencies for both frontend and backend:

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Set Up the Database

Create the MySQL database:

```sql
CREATE DATABASE transitops;
```

### 3. Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your MySQL credentials:

```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/transitops"
SESSION_SECRET="change-me-to-a-long-random-string"
PORT=4000
```

> **Note:** If your MySQL root user has no password, use `mysql://root:@localhost:3306/transitops`

### 4. Run Migrations and Seed

```bash
cd backend
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

The seed creates:
- 1 demo organisation
- 5 users (one per role)
- 8 vehicles across different statuses
- 6 drivers (including edge cases: expired licence, suspended, unverified)
- 6 trips in every status
- 3 months of maintenance, fuel, and expense history

### 5. Start Development Servers

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 🔑 Demo Credentials

All demo accounts use the same password: **`Demo@123`**

The login page includes **quick-access role buttons** — click any role to auto-fill credentials and sign in instantly.

| Role | Email | Landing Page |
|---|---|---|
| **Admin** | `admin@transitops.local` | Dashboard |
| **Fleet Manager** | `fleet@transitops.local` | Vehicles |
| **Safety Manager** | `safety@transitops.local` | Drivers |
| **Financial Manager** | `finance@transitops.local` | Fuel & Expenses |
| **Driver** | `driver@transitops.local` | My Trips |

---

## 📁 Project Structure

```
transitops/
├── README.md
├── plan.md                          # Full implementation plan
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema (11 models, 7 enums)
│   │   ├── seed.ts                  # Demo data seeder
│   │   └── migrations/              # Prisma migrations
│   └── src/
│       ├── index.ts                 # Server bootstrap
│       ├── app.ts                   # Express app setup (routes, middleware, error handler)
│       ├── config/
│       │   └── env.ts               # Zod-validated environment config
│       ├── lib/
│       │   ├── db.ts                # Prisma client singleton
│       │   └── auth/
│       │       ├── password.ts      # bcrypt hashing
│       │       ├── session.ts       # JWT sign/verify (Jose)
│       │       └── rbac.ts          # Role → permission map
│       ├── middleware/
│       │   └── auth.ts              # requireAuth + requirePermission
│       ├── routes/
│       │   ├── auth.ts              # Login/logout/me
│       │   ├── users.ts             # User management (Admin)
│       │   ├── vehicles.ts          # Vehicle CRUD
│       │   ├── drivers.ts           # Driver CRUD
│       │   ├── trips.ts             # Trip lifecycle
│       │   ├── maintenance.ts       # Maintenance logs
│       │   ├── finance.ts           # Fuel + expenses + reports
│       │   ├── dashboard.ts         # KPIs + monthly data
│       │   ├── verification.ts      # Licence verification
│       │   ├── activity.ts          # Audit log
│       │   └── notifications.ts     # User notifications
│       ├── services/
│       │   ├── trips.ts             # Trip state machine + dispatch logic
│       │   ├── activity.ts          # logActivity() helper
│       │   └── verification/
│       │       ├── adapter.ts       # LicenceVerifier interface
│       │       └── mock.ts          # MockDigiLockerVerifier
│       └── validation/              # Zod schemas per entity
│
├── frontend/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.ts               # Dev proxy: /api → localhost:4000
│   └── src/
│       ├── main.tsx                 # Entry point
│       ├── App.tsx                  # Root component + routing + role-based redirect
│       ├── index.css                # Global styles + design tokens
│       ├── lib/
│       │   ├── api.ts               # Typed API client (all endpoints)
│       │   └── auth.tsx             # AuthProvider context + hooks
│       ├── components/
│       │   ├── Shell.tsx            # App shell: sidebar (role-filtered) + header
│       │   └── NotificationBell.tsx # Notification dropdown
│       └── pages/
│           ├── Login.tsx            # Login + role quick-access buttons
│           ├── Dashboard.tsx        # KPI cards + charts (Recharts)
│           ├── Vehicles.tsx         # Vehicle list + CRUD forms
│           ├── Drivers.tsx          # Driver list + CRUD + verification
│           ├── Trips.tsx            # Trip list + lifecycle actions
│           ├── Maintenance.tsx      # Maintenance log management
│           ├── FuelExpenses.tsx     # Fuel logs + expenses + cost analysis
│           ├── Users.tsx            # User management (Admin)
│           └── ActivityLog.tsx      # Audit trail viewer
```

---

## 🧪 Testing

Run the test suite:

```bash
cd backend
npm run test
```

### What's tested:

- **Dispatch validation matrix** — Each failing rule (vehicle unavailable, driver suspended, licence expired, unverified, overweight cargo) produces the correct error
- **Double-dispatch race condition** — Two concurrent dispatches for the same vehicle → one succeeds, one fails (row-lock verification)
- **Trip completion odometer math** — `actualDistanceKm = finalOdometer − vehicle.odometerKm`
- **Illegal status transitions** — Completing a draft trip, dispatching a completed trip, etc. → rejected
- **RBAC** — 7 test cases verifying role-based permission enforcement

### Other checks:

```bash
cd backend && npm run typecheck    # TypeScript strict mode
cd frontend && npm run lint         # oxlint
cd frontend && npm run build        # Production build
```

---

## 👥 Team

**Team Network Retardz** — Odoo Hackathon 2026
