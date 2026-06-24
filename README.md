# dmaths — Learner Accountability & Intervention Management System (LAIMS)

Next.js 15 (App Router) + TypeScript + Tailwind + Recharts, on Supabase
(Postgres, Auth, RLS). A full LAIMS: auth, a protected dashboard, and screens
to capture and manage every accountability signal — scores, attendance,
assignments, interventions — plus printable reports and a supervisor role.

## 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor → run, in order: `supabase/schema.sql`, `migration_arms.sql`,
   `migration_setup.sql`, `migration_laims.sql` (supervisor role),
   `migration_trend.sql` (declining-trend early-warning signal),
   `migration_subjects.sql` (lets you rename/delete subjects),
   `migration_enrollment.sql` then `migration_join_term.sql`
   (mid-term joiners — see §below).
3. Storage → create a **private** bucket named `evidence`, then run
   `migration_evidence_storage.sql` (own-files read/write/delete policies for
   the Weekly tracker uploads).
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

## Tests & CI
The SQL-derived rules (grading bands, performance category, risk scoring, KPI
math) are mirrored once in `lib/grading.ts` and covered by Vitest:
```bash
npm test
```
`.github/workflows/ci.yml` runs `npm test` + `npm run build` on every PR (with
placeholder Supabase env vars so the static prerender passes).

## Screens
| Route | What it does |
|-------|--------------|
| `/dashboard` | KPIs, performance & risk charts, at-risk list (names link to profiles). A **component breakdown** + Total/CA1/CA2/Exam selector analyses each assessment component (normalised to % of its max) across the average, distribution, trend and rankings. |
| `/scores` | Bulk score-entry grid — live totals, mark-cap validation, one upsert save. |
| `/attendance` | Daily per-arm register (Present / Late / Absent), one upsert per date. |
| `/assignments` | Create assignments per arm and mark each learner's submission status. |
| `/weekly` | Weekly accountability tracker — log topic/objectives/activity/homework/participation/reflection and upload evidence files. |
| `/interventions` | **Core LAIMS:** early-warning feed → log issue + strategy → track status, follow-up and outcome on a board. |
| `/learners/[id]` | 360° learner profile + printable report card (scores, attendance, submissions, interventions). |
| `/reports` | Class broadsheet (every learner × subject, per term/session) — print or export CSV. |
| `/oversight` | Supervisor/admin only — cross-teacher rollup of learners, averages, risk and open interventions. |
| `/classes` | Create arms and add learners (single or CSV import); delete arms/learners. |
| `/subjects` | Manage the shared subject list — add, rename, delete (delete is blocked while scores reference it). |
| `/settings` | Edit your name/department and change password. |

A **global search** (icon in the nav, or ⌘/Ctrl-K) finds any learner by name or
admission number and jumps to their profile. Learner profiles include a **month
attendance calendar**, and `/attendance` has a per-arm **month overview** heatmap.

**Dark mode** is app-wide: toggle it from the nav (☾/☀). The choice persists in
`localStorage` and is applied before first paint (no flash); the theme is driven
by CSS variables in `app/globals.css`, so every screen follows it. Reports always
print on a light sheet regardless of the active theme.

Attendance and assignment data feed the dashboard's attendance %, submission %
and early-warning risk score — all derived in SQL views, never duplicated in the
front end.

## Early-warning signals
The `learner_risk` view (see `migration_trend.sql`) scores four signals: low
average, low attendance, missing assignments, and a **term-over-term decline**
(latest term average vs the previous term). Declining learners show a ▼ on the
dashboard. Interventions whose `follow_up_date` has passed surface as a
**"Follow-ups due"** KPI + panel so the loop doesn't lapse.

## Mid-term joiners
A learner who joins in Term 2 or 3 shouldn't be rated in terms they weren't there
for. On the Classes page set their **Joined** to *Joined Term 2* / *Joined Term 3*
(default *From start* = present since Term 1). `migration_join_term.sql` adds
`learners.joined_session` + `joined_term`; the score-entry grid then hides a
learner from any term/session **before** they joined, so they're never entered as
a 0 and never ranked last in an earlier term. Their averages and the dashboard's
per-term analysis only cover the terms they actually have marks for. Attendance
and assignments need no special handling — a late joiner simply has no records
before they arrived. The join term also shows on the learner profile.

> Migration history: this supersedes the earlier `migration_enrollment.sql`
> (which used an exact `enrolled_on` date). Run `migration_join_term.sql` after
> it; it drops the date column and reverts the risk view to its
> `migration_trend.sql` form.

## Evidence files
Weekly evidence uploads go to the private `evidence` Storage bucket under
`<your-uid>/<weekly_tracker_id>/<file>`; the storage policy in
`migration_evidence_storage.sql` locks each file to the teacher who uploaded it.
Files are read back through short-lived signed URLs.

## Exports & data
The dashboard **Export CSV** button downloads the current learner roster, and the
broadsheet offers **CSV** alongside Print (browser Print-to-PDF). Account
self-service lives at `/settings` (name, department, change password); the login
page has a **Forgot password?** link that emails a reset (the in-app change at
`/settings` is the primary path — the email recovery-token exchange flow is not
implemented).

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
