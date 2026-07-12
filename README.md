# TransitOps — Odoo Hackathon 2026

Role-based fleet operations platform. Team leader: Nitin Mishra.

- `frontend/` — Vite + React 19 + TypeScript SPA (dev on http://localhost:5173)
- `backend/` — Express 5 + TypeScript REST API (dev on http://localhost:4000, routes under `/api`)
- Database — MySQL 8 via Prisma ORM
- Full plan: [plan.md](plan.md) · Progress: [CHECKLIST.md](CHECKLIST.md)

## Setup

### 1. MySQL

You need a local MySQL 8 server on port 3306. Then create the database once:

```sql
CREATE DATABASE transitops;
```

> **No MySQL installed?** A portable, no-admin-needed copy can live in `.local/mysql` (gitignored).
> Start it with `.local/start-mysql.cmd` if present — it uses root with no password.

### 2. Backend

```sh
cd backend
cp .env.example .env       # set your MySQL password in DATABASE_URL
npm install
npx prisma migrate dev     # creates tables
npm run db:seed            # demo org, users, fleet data
npm run dev                # API on :4000
```

### 3. Frontend

```sh
cd frontend
npm install
npm run dev                # SPA on :5173, proxies /api -> :4000
```

## Demo credentials

Password for every account: `Demo@123`

| Email | Role |
| --- | --- |
| admin@transitops.local | Admin |
| fleet@transitops.local | Fleet Manager |
| safety@transitops.local | Safety Manager |
| finance@transitops.local | Financial Manager |
| driver@transitops.local | Driver |
