# Supabase Setup

This application is configured for a Supabase project owned by your organization.

See [Project setup and verification](PROJECT_SETUP.md) for the complete workflow,
including migration checks and first-owner setup. One project represents one
business with multiple branches.

1. Create a new project at https://supabase.com/dashboard.
2. In the project settings, copy the Project URL and publishable key.
3. Replace the placeholders in `.env` with those values.
4. Link the local repository and deploy its backend:

```powershell
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list --linked
npx supabase db push --dry-run
npx supabase db push
npx supabase functions deploy create-worker
```

5. Create the first owner in Supabase Dashboard: open Authentication > Users, select **Add user**, and send an invitation to the owner email address. The first account created in the new database is automatically assigned the owner role.
6. In Supabase Dashboard, open Authentication > URL Configuration and add the local and production application URLs as redirect URLs, including `/reset-password`.
7. After first-owner setup, disable public email sign-ups and leave `VITE_ENABLE_OWNER_SIGNUP=false`. Workers are created by the primary owner through the Users page. The optional first-owner signup screen requires both the flag and Supabase email signups to be enabled temporarily.
8. Configure a 12-character password minimum and login rate limits. This app currently uses password authentication; enforcing MFA requires adding enrollment/challenge screens before requiring it for users.
9. Set the Edge Function secret `ALLOWED_ORIGINS` to a comma-separated list of the exact allowed app origins, for example `https://app.example.com,http://localhost:5173`.

The `create-worker` function creates a confirmed worker account with the secure initial password entered by the primary owner. Share that password through a secure channel and ask the worker to change it on the Account page. The application does not currently force a password change at first login.
