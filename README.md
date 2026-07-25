# Astro + Supabase authentication

Passwordless magic-link sign-in, email/password auth, and a protected dashboard. Built with Astro SSR and Supabase Auth (+ Postgres for one-time tokens and rate limits).

## Requirements

- Node.js 22.12+
- A Supabase project (local CLI or a free cloud project)
- npm

## Setup

### 1. Install dependencies

```sh
npm install
```

### 2. Configure environment

```sh
cp .env.example .env
```

Fill in `.env`:

| Variable | Notes |
| --- | --- |
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` (server only — never expose in the browser) |
| `MAGIC_LINK_SECRET` | Long random string used to HMAC-sign magic-link / reset tokens |
| `MAGIC_LINK_EXPIRY_SECONDS` | Token lifetime (default `900`) |
| `PUBLIC_SITE_URL` | Public origin of this app, e.g. `http://localhost:4321` |
| `SMTP_*` / `EMAIL_FROM` | Required only for non-local Supabase; locally, auth emails are printed to the console |

### 3. Apply the database migration

The app stores used/issued auth tokens and rate-limit counters in Postgres:

```sh
# Local Supabase
npx supabase start
npx supabase db reset   # applies supabase/migrations/*

# Or against a linked cloud project
npx supabase db push
```

You can also paste `supabase/migrations/20260725090000_auth_support.sql` into the Supabase SQL editor.

### 4. Local Supabase keys

```sh
npx supabase status
```

Copy `API URL`, `anon key`, and `service_role key` into `.env`.

### 5. Run the app

```sh
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

**Magic links (local):** when you request a magic link or password reset, the link is printed in the terminal running `astro dev`.

## Auth flows

| Path | Purpose |
| --- | --- |
| `/register` | Email + password registration |
| `/signin` | Email + password, or request a magic link |
| `/api/auth/verify` | Consumes a magic-link token and creates a session |
| `/forgot-password` / `/reset-password` | Password reset via emailed one-time link |
| `/set-password` | Logged-in users (e.g. magic-link-first) can set a password |
| `/dashboard` | Protected page — requires a valid session |
| `/api/auth/signout` | Revokes the Supabase session and clears cookies |

## Production build

This project uses the `@astrojs/node` standalone adapter:

```sh
npm run build
node ./dist/server/entry.mjs
```

Set `PUBLIC_SITE_URL` to your real origin, configure SMTP, and use HTTPS so `Secure` cookies apply (`PROD`).

## Security notes (intentional choices)

- Session cookies are `httpOnly`, `SameSite=Lax`, and `Secure` in production.
- Auth forms include a CSRF token checked on POST.
- Magic-link / reset tokens are HMAC-signed, expiring, and one-time (persisted in `magic_link_tokens`).
- Auth endpoints are rate-limited per email via `auth_rate_limits`.
- Password sign-in failures use a generic message (no email enumeration).
- Forgot-password always shows the same success message whether or not the email exists.
- The service role key stays on the server only.

## GitHub access for review

Invite `stijnvanpeer@peerfect.be` as a collaborator on the repository once you are ready for review.
