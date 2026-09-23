# UFBC Agrodealer setup and verification

This is a single-business, multi-branch application built with React, TanStack Start,
TypeScript, Tailwind CSS and Supabase. The existing owner/worker permissions,
catalog pricing and stock calculations are enforced by PostgreSQL.

See [Data retention](DATA_RETENTION.md) for year-round storage and annual report retrieval.

## Local development

Use a current Node.js 22 LTS release (22.13 or newer is recommended for all lint
dependencies) and npm. On Windows PowerShell, use `npm.cmd`/`npx.cmd` if execution
policy prevents running the corresponding `.ps1` wrappers.

```powershell
npm.cmd ci
Copy-Item .env.example .env # only for a new checkout; do not overwrite your existing .env
# Fill in your own Supabase URL and publishable key in .env.
npm.cmd run check:env
npm.cmd run check:env -- --remote
npm.cmd run dev
```

Vite prints the local URL. Keep the server and browser Supabase values identical.
After `npm.cmd run build`, use `npm.cmd run preview` to serve the generated Vercel
output locally. `npm.cmd run test:production` verifies login hydration and the
per-request Content Security Policy nonce against that build. Install Playwright's
Chromium browser first with `npx.cmd playwright install chromium`, or set
`PLAYWRIGHT_CHANNEL=msedge` when using an installed Microsoft Edge browser.
Never use a service-role key or Supabase management access token in `VITE_` variables.
The committed example contains placeholders; the real `.env` is ignored by Git.

## Database deployment

The SQL files in `supabase/migrations` are the schema source of truth. Do not
reset a hosted database or apply only the newest file to an empty project.

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
npx.cmd supabase migration list --linked
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
npx.cmd supabase functions deploy create-worker
npx.cmd supabase db query --linked --file scripts/verify-hosted.sql
node scripts/check-worker-function.mjs
```

For an existing project, compare local and remote migration history before
pushing. A mismatch needs reconciliation, not a reset or blind migration repair.
The September 4 migrations add the `create_sale` RPC and business profile field;
the September 22 migration preserves history when workers or empty branches are
removed. The frontend requires the complete migration chain.

Set the Edge Function's `ALLOWED_ORIGINS` secret to the exact app origins. Supabase
provides the function's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; those private
values do not belong in the browser. Only the primary owner can create workers
and manage roles. Worker records use the database role `manager`.

## First owner and login

The first auth user in an empty database becomes the primary owner. Later users
are managers; signup does not create a second isolated business.

For an existing business, keep public Supabase email signups disabled and create
workers from the Users page. For a fresh installation, either invite the first
owner through the Supabase dashboard or temporarily enable email signups and set
`VITE_ENABLE_OWNER_SIGNUP=true` for first-owner setup. Turn both off after bootstrap
and rebuild. The UI flag alone is not an authorization boundary.

Configure Supabase Auth's site URL and redirect allowlist for your app's `/auth`
and `/reset-password` URLs. Configure email delivery for confirmation/recovery.
Owner and worker tabs share authentication; actual permissions come from the
database role. Workers need an active branch assignment before recording sales.

## Verification

```powershell
npm.cmd run check        # typecheck, lint and isolated database regression tests
npm.cmd run build        # typecheck plus Vercel production build
npm.cmd run format:check
npx.cmd playwright install chromium # once, for browser regression tests
npm.cmd run test:browser
```

The database tests run actual PostgreSQL via PGlite in memory. They apply all
migrations and compare table/view columns and RPC arguments with the frontend
types. They exercise first-owner creation, branch isolation, catalog pricing,
stock transfers, failed-sale rollback and history retention. They simulate
Supabase's auth roles/schema; they do not prove hosted Auth, email or Edge Function
configuration, and they never touch production records.

Browser tests cover desktop/mobile login, protected-route redirects, the 404
page, PDF generation and complete paginated exports. To use installed Edge on
Windows instead of downloading Chromium, set `$env:PLAYWRIGHT_CHANNEL='msedge'`
before running them. Tests start a local server on port 5177 and use synthetic
report data; they do not create business records.

See `VERCEL_DEPLOYMENT.md` for hosting settings. Deployment remains separate from
local validation: a passing build does not deploy migrations or Edge Functions.
