# Ironleaf Gym Membership

Role-based gym membership platform: check-in/out, member CRM, body progress, dashboards/reports, renewal & birthday notifications.

**Stack:** Next.js · NestJS · Tailwind · PostgreSQL · Prisma · Docker (Postgres + Mailhog)

## Prerequisites
- Node.js 20+
- npm 10+
- Docker Desktop (Compose)

## Quick start

```bash
# from repo root
cp .env.example .env   # already present for local defaults
npm install
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Postgres is published on **host port 5433** (avoids clashing with a local Postgres on 5432).

- Web: http://localhost:3000  
- API: http://localhost:3001/api  
- Mailhog UI: http://localhost:8025  

### Demo logins (password: `password123`)
| Email | Role |
|-------|------|
| admin@gym.local | Admin |
| staff@gym.local | Staff |
| alice@gym.local | Member (renewal soon + birthday today) |
| carlos@gym.local | Member |
| dana@gym.local | Member |

## Scripts
| Script | Purpose |
|--------|---------|
| `npm run dev` | API (:3001) + web (:3000) |
| `npm run db:up` | Start Postgres + Mailhog |
| `npm run db:migrate` | Prisma migrate |
| `npm run db:seed` | Seed plans, users, sample data |
| `npm run db:generate` | Generate Prisma client |

## Features
- **Time in/out** — staff desk search + member self check-in
- **Member information** — profiles, plans, status, renewals
- **Body progress** — metrics + Recharts trends
- **Dashboards / reports** — KPIs, charts, CSV export, rule-based suggestions
- **Notifications** — renewal (7/3/1 days) & birthday emails + in-app alerts  
  Admin → Alerts → “Run daily jobs now” to test without waiting for cron
- **Settings** — company name, logo (URL or image upload), currency (default **PHP**) via Admin → Settings

## Browser support
Last two major versions of **Chrome, Firefox, Edge, and Safari**. The UI uses semantic HTML, responsive Tailwind layouts, and Autoprefixer — no Chromium-only APIs.

## Project layout
```
apps/api     NestJS + Prisma
apps/web     Next.js App Router + Tailwind
docs/PRD.md  Product requirements
docker-compose.yml
```

## Environment
See `.env.example`. Key vars: `DATABASE_URL`, `JWT_*`, `SMTP_*`, `NEXT_PUBLIC_API_URL`, `CORS_ORIGIN`.
