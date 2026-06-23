# dmaths — Learner Accountability & Intervention Management System (LAIMS)

Next.js 15 (App Router) + TypeScript + Tailwind + Recharts, on Supabase
(Postgres, Auth, RLS). A full LAIMS: auth, a protected dashboard, and screens
to capture and manage every accountability signal — scores, attendance,
assignments, interventions — plus printable reports and a supervisor role.

## 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor → run, in order: `supabase/schema.sql`, `migration_arms.sql`,
   `migration_setup.sql`, then `migration_laims.sql` (adds the supervisor role).
3. Storage → create a **private** bucket named `evidence`, then uncomment
   the two storage policies at the bottom of the schema and run them.
4. Authentication → add yourself a user (email + password), or enable signups.
5. The `migration_setup.sql` trigger creates your `profiles` row automatically.

## 2. App
```bash
cp .env.example .env.local      # fill in URL + anon key from Supabase → API
npm install
npm run dev                     # http://localhost:3000
```
Unauthenticated visits bounce to `/login`. After signing in you land on
`/dashboard`, which renders on schema-shaped **sample data** until you wire
the live queries.

## 3. Go live with real data
In `app/dashboard/page.tsx`, uncomment the imports from
`lib/dashboard-queries.ts`, fetch the teacher's class, and pass the rows into
`<Dashboard />`. The query functions read the `learner_risk_level` and
`score_report` views, so the grading + risk rules stay in SQL — never
duplicated in the front end.

## Deploy
Push to GitHub → import in Vercel → add the same two env vars → deploy.
Supabase needs no separate hosting.

## Screens
| Route | What it does |
|-------|--------------|
| `/dashboard` | KPIs, performance & risk charts, at-risk list (names link to profiles). |
| `/scores` | Bulk score-entry grid — live totals, mark-cap validation, one upsert save. |
| `/attendance` | Daily per-arm register (Present / Late / Absent), one upsert per date. |
| `/assignments` | Create assignments per arm and mark each learner's submission status. |
| `/interventions` | **Core LAIMS:** early-warning feed → log issue + strategy → track status, follow-up and outcome on a board. |
| `/learners/[id]` | 360° learner profile + printable report card (scores, attendance, submissions, interventions). |
| `/reports` | Printable class broadsheet (every learner × subject, per term/session). |
| `/oversight` | Supervisor/admin only — cross-teacher rollup of learners, averages, risk and open interventions. |
| `/classes` | Create arms and add learners (single or CSV import). |

Attendance and assignment data feed the dashboard's attendance %, submission %
and early-warning risk score — all derived in SQL views, never duplicated in the
front end.

## Roles
The single-teacher RLS spine is unchanged: a teacher owns their classes →
learners → scores/attendance/submissions/interventions. `migration_laims.sql`
adds **read-only** "supervisor read" policies so users with
`role in ('supervisor','admin')` can see across all teachers and use `/oversight`.
Promote a user after they sign up:
```sql
update profiles set role = 'supervisor' where email = 'head@school.org';
```

## Reporting
Reports are browser **Print-to-PDF** views (no extra dependencies). A
`@media print` block in `app/globals.css` hides nav/controls (`.no-print`) and
reveals print-only headers (`.print-only`). Use the **Print** buttons on
`/learners/[id]` and `/reports`.
