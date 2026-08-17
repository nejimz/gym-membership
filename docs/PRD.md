# Product Requirements Document — Ironleaf Gym Membership Platform

## 1. Overview
Ironleaf is a role-based gym membership platform for front-desk operations and member self-service. It covers member CRM, check-in/out, body progress tracking, dashboards/reports with rule-based suggestions, and renewal/birthday notifications.

**Tech stack:** Next.js (web), NestJS (API), Tailwind CSS, PostgreSQL, Prisma, Docker Compose (Postgres + Mailhog).

## 2. Goals
- Give staff a fast check-in desk and member management workflow.
- Give members visibility into visits, progress, and renewal status.
- Give admins operational KPIs, reports, and notification tooling.
- Run fully locally with one Docker Compose stack and documented seed users.

## 3. Personas & roles
| Role | Primary jobs |
|------|----------------|
| **Admin** | Full access: dashboards, members, check-in, reports, trigger notification jobs |
| **Staff** | Members, check-in/out, dashboard, alerts |
| **Member** | Self check-in/out, progress logs, visit history, personal alerts |

## 4. User stories (MVP)
1. As staff, I can search a member and record time-in / time-out without double open sessions.
2. As staff/admin, I can create and update member profiles, plans, and status.
3. As a member, I can view my membership end date and visit history.
4. As a member or staff, I can log body metrics and view trend charts.
5. As admin/staff, I see dashboard KPIs (active members, today’s check-ins, renewals, birthdays).
6. As any user, I receive in-app and email alerts for renewals and birthdays.
7. As admin, I can export attendance CSV and view attendance charts.
8. As a developer, I can start Postgres, Mailhog, API, and web locally from README steps.

## 5. Functional requirements

### 5.1 Authentication & access
- Email/password login; JWT access token (Bearer + httpOnly cookie) and refresh cookie.
- Route protection by role on API (guards) and web (shell redirects).

### 5.2 Member information
- Fields: name, email, phone, DOB, emergency contact, plan, start/end dates, status (ACTIVE / EXPIRED / SUSPENDED), optional photo URL.
- Staff/admin CRUD; members may update limited profile fields.

### 5.3 Time in / out
- Staff desk: search → check-in / check-out.
- Member self check-in/out from dashboard.
- One open session per member; checkout closes the latest open session.

### 5.4 Body progress
- Metrics: weight, body fat %, chest/waist/hips/arms, notes, photo URL.
- History table + line charts (Recharts).

### 5.5 Dashboards & reports
- Staff/admin: KPI cards, attendance series, status mix, birthday list, rule-based suggestions.
- Member: visits this month, streak, days to renewal, latest metrics, suggestions.
- Admin reports: 30-day attendance chart + CSV export.

### 5.6 Suggestions (rule-based)
- Low weekly visit rate → encourage ≥3 visits/week.
- Weight plateau across recent logs → coach/nutrition review.
- Renewal ≤7 days → renew CTA.
- Soft floor volume / upcoming birthdays for staff digests.

### 5.7 Notifications
- Daily cron (08:00): renewals at 7/3/1 days; birthdays today.
- Persisted `Notification` rows + SMTP email via Mailhog locally.
- In-app list with mark-read; admin can run jobs manually for testing.

### 5.8 Settings (company + currency)
- Admin-only settings page for company name, logo (external URL or image upload), and currency.
- Default currency: **PHP (Philippine Peso)**; also USD / EUR.
- Public `GET /api/settings` powers login/shell branding; money displays use `Intl.NumberFormat`.
- Logo uploads are stored under `/uploads/logos/` and served by the API.

## 6. Non-functional requirements
- **Local setup:** Docker Compose for Postgres + Mailhog; npm workspaces; migrate + seed scripts.
- **Browser compatibility:** Chrome, Firefox, Edge, Safari — last two major versions. Semantic HTML, Tailwind responsive layouts, no Chromium-only APIs, Autoprefixer for CSS.
- **Security (MVP):** password hashing (bcrypt), JWT secrets via env, RBAC on every protected route, CORS limited to web origin.
- **Performance (MVP):** dashboard queries scoped; attendance series aggregated client-side from recent rows.

## 7. Data model (summary)
User, MembershipPlan, MemberProfile, Attendance, BodyMetric, Notification, AuditLog, AppSettings — see `apps/api/prisma/schema.prisma`.

## 8. API outline
| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/login`, `refresh`, `logout`, `change-password`, `GET /me` |
| Plans | `GET /api/plans` (active), `GET /all` (admin), `POST`, `PATCH /:id` (admin) |
| Members | `GET/POST /api/members`, `GET/PATCH /:id`, renewals, birthdays |
| Attendance | `POST check-in/out`, `GET today`, `GET member/:id` |
| Progress | `POST /api/progress`, `GET /:memberId` |
| Reports | `GET dashboard`, `attendance-series`, `attendance.csv` |
| Notifications | `GET /`, unread-count, mark read, `POST run-jobs` (admin) |
| Settings | `GET /api/settings` (public), `PATCH /api/settings` (admin), `POST/DELETE /api/settings/logo` (admin) |

## 9. Out of scope (v1)
Payment gateway, biometric/QR hardware, native mobile apps, ML coaching, multi-branch franchising, file upload service.

## 10. Success criteria
- Seeded users can log in by role and reach the correct dashboard.
- Staff can check a member in/out; member can self check-in.
- Progress charts render from seeded/new metrics.
- Running notification jobs creates in-app rows and Mailhog emails for renewal/birthday scenarios.
- README alone is enough for a new developer to run the stack locally.
