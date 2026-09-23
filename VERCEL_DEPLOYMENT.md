# Vercel Production Setup

The application is built for Vercel through Nitro's `vercel` preset. Do not set an Output Directory in the Vercel project; the build creates Vercel's required `.vercel/output` artifact itself.

Use these Vercel project settings:

- Framework Preset: `Other`
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: leave empty
- Node.js Version: `22.x`

Add these environment variables to **Production**, **Preview**, and **Development**:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
VITE_ENABLE_OWNER_SIGNUP=false
```

The `VITE_` variables are compiled into the browser bundle. They must be present before every Vercel build. The values are public Supabase project connection values; never put `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_` variable.

In Supabase Authentication, add each Vercel production domain and preview domain to the allowed redirect URLs, including:

```text
https://<your-domain>/reset-password
```

After changing environment variables or the Vercel build settings, redeploy the project. Vercel does not apply new build-time variables to an already deployed bundle.

Before launch, configure Supabase Authentication with public sign-ups disabled after owner setup, a 12-character password minimum and login rate limits. MFA enrollment and challenge screens are not implemented, so do not require MFA until that flow is added. Set the `ALLOWED_ORIGINS` Edge Function secret in Supabase to the exact production origin(s); this is separate from Vercel environment variables.
