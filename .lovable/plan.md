
## Context

Your GitHub repo (`sudeepdas12/RTA.RTS`) is a Django 4.2 + React 18 + PostgreSQL system with these modules: **Companies, Clients, Users (roles), Interest Payables (Debenture), Dividend Payables (Stock), Debenture Reconciliation, IAF Allocations, Bank Reconciliation, Reports/Dashboard, Uploads, Fiscal Year Settings, Pending Approvals, Audit Logs**.

The current Lovable project is a blank TanStack Start template. Rebuilding the entire system 1:1 in one turn is not realistic — it's several days of work. I'll ship it in phases so each one is verifiable, and you approve after each phase.

## Target Stack

- TanStack Start (React 19, SSR, Vite) — already scaffolded
- Lovable Cloud (Postgres + Auth + RLS) — replaces Django/DRF/JWT + Postgres
- TanStack Query + server functions — replaces Django REST endpoints
- Shadcn UI + Tailwind v4 — replaces Bootstrap 5
- Recharts — replaces Chart.js
- XLSX + jsPDF — Excel/PDF export

## Phase Plan

### Phase 1 — Foundation (this turn)
- Enable Lovable Cloud
- Design system (professional finance-app palette, typography, tokens)
- Auth (email/password) + `profiles` table + `user_roles` table with `app_role` enum (`admin`, `finance_operator`, `reconciliation_officer`, `auditor`, `report_viewer`) + `has_role()` security-definer function
- Full DB schema (all tables + RLS + grants) mirroring the Django models
- App shell: sidebar nav, top bar, protected `_authenticated` layout, sign-in/sign-up pages
- Dashboard skeleton with KPIs pulling from real tables
- Sitemap/robots, SEO metadata

### Phase 2 — Master data
- Companies module: list/create/edit/delete + Excel import/export
- Clients (Shareholders) module: same + BOID lookup
- Users management (admin only): list users, assign/revoke roles
- Audit log recording on all writes (DB trigger)

### Phase 3 — Debenture Interest module (your active work)
- Interest Payables: list with filters (company, status, due date), create/edit, bulk Excel upload with smart mapping, auto-calc net = gross − tax, mark paid, payment reference
- Debenture Reconciliation table + reconciliation report matching the Django "DebentureReconciliation" model

### Phase 4 — Stock Dividend module (mirrors Interest)
- Dividend Payables with the same UX as Interest: list/filters/create/edit/bulk upload/mark paid, fiscal-year grouping, shares × rate calc

### Phase 5 — Reconciliation, Allocations, Reports
- Bank Reconciliation: upload bank statement, auto-match to payables, manual match UI
- IAF Allocations
- Fiscal Year Settings
- Pending Approvals workflow (maker/checker)
- Reports page: charts + Excel/PDF export
- Uploads history

### Phase 6 — Polish
- Full audit log viewer
- Empty/loading/error states everywhere
- Publish

## This Turn Deliverable

I'll complete **Phase 1** end-to-end: Cloud enabled, schema + RLS + roles migrated, auth working, protected app shell with nav to every module (stub pages for phases 2–5 so links exist), and a live Dashboard reading counts from the DB. You'll be able to sign up, get an admin role, and see the whole navigation tree.

Then you approve, and I run Phase 2, then 3, etc. Each phase is one message.

## Technical Notes

- All roles in `user_roles` table (never on `profiles`) with `has_role(uuid, app_role)` SECURITY DEFINER function to avoid recursive RLS.
- Every table gets explicit `GRANT` + RLS policies (`SELECT/INSERT/UPDATE/DELETE` scoped per role).
- Money as `numeric(15,2)`; dates as `date`; audit trigger writes to `audit_logs` on INSERT/UPDATE/DELETE.
- Bulk upload uses SheetJS in the browser + a server function to bulk-insert with validation.
- File structure: `src/routes/_authenticated/{companies,clients,users,interest,dividend,reconciliation,allocations,reports,uploads,settings,audit}.tsx`, `src/lib/*.functions.ts` for server fns.

Confirm and I'll start Phase 1.
