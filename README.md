# Reporting Matrix

Internal web app for the legal department to log tasks and generate periodic reports.

Stack: Next.js 14 (App Router), TypeScript, TailwindCSS, Supabase (Auth/Postgres/Storage), pdf-lib, docx

Quick start

1. Copy `.env.example` to `.env.local` and fill in Supabase keys (or set env vars in Vercel):

```bash
cp .env.example .env.local
# then edit .env.local
```

2. Install dependencies:

```bash
npm install
```

3. Run the dev server locally:

```bash
npm run dev
```

Database migrations

- The SQL migration is in `migrations/01_init.sql`. It creates `users`, `tasks`, `attachments`, and `reports` tables, the `reporting_area` enum, helper RPCs, and Row Level Security policies.
- To apply the migration to your Supabase project use the `supabase` CLI or the SQL editor in the Supabase dashboard. Example using the CLI:

```bash
supabase login
supabase db remote set <your-db-connection-string>
supabase db push migrations/01_init.sql
```

Security notes

- The project uses Supabase Row Level Security (RLS). The SQL includes policies to allow only authors to update/delete their tasks and restrict admin operations to users with role `Admin`.
- The server-side API endpoints (`/api/admin/*`, `/api/generate-report`) require an Authorization Bearer token. The server verifies the token and checks the user's role before performing privileged actions. Do not expose `SUPABASE_SERVICE_ROLE_KEY` in the browser.

Deployment (Vercel)

- Add the following environment variables in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_REPORTS_BUCKET`.
- Use the Vercel build command `npm run build` and the output directory will be managed by Next.js automatically.

Applying migrations in production

- Prefer running migrations from a secure CI/CD job or manually via the Supabase dashboard. The migration in `migrations/01_init.sql` is idempotent (uses `create table if not exists`).

Further notes

- Report files are stored in the Supabase Storage bucket configured by `SUPABASE_REPORTS_BUCKET` and a `reports` metadata table keeps track of generated reports with `generated_by`, `start_date`, `end_date`, and `frequency`.
- For production hardening, add server-side session cookie verification (or Next.js middleware) to ensure API routes are called only by authenticated users. The scaffold includes `src/lib/serverAuth.ts` and examples in `app/api`.

If you want, I can prepare a single SQL bundle for your Supabase project or help run migrations from this environment after you confirm. 
