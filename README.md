# UFBC Agrodealer

Inventory, purchases, sales, customers, branch management and reporting for one
agricultural business with multiple branches. Built with React, TanStack Start,
TypeScript, Tailwind CSS and Supabase.

Start with [Project setup and verification](PROJECT_SETUP.md), then follow
[Vercel deployment](VERCEL_DEPLOYMENT.md) when publishing.

```sh
npm ci
npm run check:env
npm run dev
```

For a new checkout, copy `.env.example` to `.env` and configure the project URL and
public key first. Do not overwrite an existing `.env`. On Windows PowerShell,
use `npm.cmd` if script execution policy blocks `npm`.

Run `npm run check` for TypeScript, lint and isolated PostgreSQL tests. Run
`npm run build` for the production bundle. Business rules and permissions live
in the versioned SQL migrations; local tests do not modify the hosted database.
