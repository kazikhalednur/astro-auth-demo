# Astro + Supabase authentication

Small SSR auth demo: **magic link**, **email + password**, and a **protected dashboard**.

Stack: [Astro](https://astro.build) (Node adapter) + [Supabase](https://supabase.com) Auth and Postgres.

> Styling is intentionally minimal — plain HTML forms. The focus is auth behaviour, security, and code quality.

## Quick start (local Supabase)

```sh
npm install
cp .env.example .env

npx supabase start
npx supabase status   # copy API URL, anon key, service_role key into .env
npx supabase db reset # applies migrations in supabase/migrations/

# Generate a signing secret, then put it in .env as MAGIC_LINK_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

Auth emails (magic link / password reset) are **printed in the terminal** when `SUPABASE_URL` points at localhost — no SMTP needed.

## Requirements

- Node.js **22.12+**
- npm
- Either:
  - [Supabase CLI](https://supabase.com/docs/guides/cli) for local development, or
  - a free Supabase cloud project

## Environment variables

Copy `.env.example` → `.env` and fill in:

| Variable | Required | Description |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Project URL (local: from `supabase status`) |
| `SUPABASE_ANON_KEY` | yes | Anon / public key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service role key — **server only**, never expose in the browser |
| `MAGIC_LINK_SECRET` | yes | Long random string used to HMAC-sign magic-link and reset tokens |
| `MAGIC_LINK_EXPIRY_SECONDS` | no | Token lifetime in seconds (default `900`) |
| `PUBLIC_SITE_URL` | yes | Public origin of this app (`http://localhost:4321` in dev) |
| `SMTP_HOST` | cloud only | SMTP host for sending auth emails |
| `SMTP_PORT` | cloud only | Usually `587` |
| `SMTP_USER` / `SMTP_PASS` | cloud only | SMTP credentials (if required by your provider) |
| `EMAIL_FROM` | cloud only | From address, e.g. `Auth Demo <noreply@example.com>` |

## Database migration

The app uses two small Postgres tables (one-time tokens + rate limits):

- `magic_link_tokens`
- `auth_rate_limits`

**Local**

```sh
npx supabase start
npx supabase db reset
```

**Cloud**

```sh
npx supabase db push
```

Or paste `supabase/migrations/20260725090000_auth_support.sql` into the Supabase SQL editor.

## Cloud Supabase notes

1. Apply the migration (above).
2. Set SMTP vars in `.env` (or auth emails will fail outside local mode).
3. Set `PUBLIC_SITE_URL` to the URL where the app is reachable.
4. For a smooth local-style flow, disable **Confirm email** under  
   Authentication → Providers → Email  
   (otherwise new users must confirm before password sign-in works).

Magic links in this app are **custom** (HMAC tokens + your SMTP/console). They do not rely on Supabase’s built-in magic-link email templates.

## What to try

| Action | Where |
| --- | --- |
| Register with email + password | `/register` |
| Sign in with email + password | `/signin` |
| Request a magic link | `/signin` → “Email me a login link” |
| Open a protected page | `/dashboard` (redirects to sign-in if logged out) |
| Forgot password | `/forgot-password` |
| Set a password after magic-link login | `/set-password` (prompted from the dashboard) |
| Sign out | Dashboard → Sign out |

## Project layout

```text
src/
  lib/                 # cookies, CSRF, email, magic-link, rate-limit, supabase, validation
  middleware.js        # session restore + route protection
  pages/
    index.astro
    signin.astro
    register.astro
    dashboard.astro    # protected
    forgot-password.astro
    reset-password.astro
    set-password.astro # protected
    api/auth/          # signin, register, magic-link, verify, signout, …
supabase/
  migrations/          # auth support tables
```

## Scripts

| Command | Action |
| --- | --- |
| `npm run dev` | Dev server at `http://localhost:4321` |
| `npm run build` | Production build (`dist/`) |
| `npm run preview` | Preview the production build |

## Production

```sh
npm run build
node ./dist/server/entry.mjs
```

Uses `@astrojs/node` in standalone mode. For a real deploy:

- set `PUBLIC_SITE_URL` to your public origin
- configure SMTP
- serve over HTTPS so `Secure` session cookies apply

## Security choices

- Session cookies: `httpOnly`, `SameSite=Lax`, `Secure` in production
- CSRF token on auth form POSTs
- Magic-link / reset tokens: HMAC-signed, expiring, one-time (stored in Postgres)
- Per-email rate limits on sensitive auth endpoints
- Generic error on failed password sign-in (no email enumeration)
- Forgot-password always shows the same success message
- Service role key used only on the server
