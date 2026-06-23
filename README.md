# dmaths — Learner Tracking Web App

Next.js 15 (App Router) + TypeScript + Tailwind + Recharts, on Supabase
(Postgres, Auth, RLS). This is the runnable skeleton: auth, a protected
dashboard, and the data layer wired to the v1 schema.

## 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor → paste `supabase/schema.sql` → Run.
3. Storage → create a **private** bucket named `evidence`, then uncomment
   the two storage policies at the bottom of the schema and run them.
4. Authentication → add yourself a user (email + password), or enable signups.
5. After your first login, insert your `profiles` row (id = your auth user id).

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

## What's NOT in this skeleton (by design)
- Score-entry / attendance / assignment forms (the screens that create data)
- PDF report generation
- Supervisor / admin roles (you occupy all roles for now)

Build those next against the same schema and RLS spine.

## Update — arms + score entry
- Run `supabase/migration_arms.sql` after the base schema (adds grade_level + arm).
- `/scores` is the bulk score-entry grid — one editable row per learner, live
  totals, validation against the mark caps, and a single upsert save.
- Wire it live by uncommenting the imports in `app/scores/page.tsx`.
