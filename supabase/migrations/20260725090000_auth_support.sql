-- Support tables for durable magic-link one-time tokens and auth rate limiting.
-- Accessed only via the service role from the Astro server (RLS denies public access).

create table if not exists public.magic_link_tokens (
  jti text primary key,
  email text not null,
  purpose text not null default 'magic_link'
    check (purpose in ('magic_link', 'password_reset')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists magic_link_tokens_email_idx
  on public.magic_link_tokens (email);

create index if not exists magic_link_tokens_expires_at_idx
  on public.magic_link_tokens (expires_at);

create table if not exists public.auth_rate_limits (
  bucket text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

alter table public.magic_link_tokens enable row level security;
alter table public.auth_rate_limits enable row level security;

-- No policies for anon/authenticated. Grant table access to service_role explicitly
-- (local Supabase no longer auto-exposes new public tables to API roles).
grant select, insert, update, delete on public.magic_link_tokens to service_role;
grant select, insert, update, delete on public.auth_rate_limits to service_role;

-- Efficient email → user id lookup for password reset (service_role only).
create or replace function public.find_auth_user_id_by_email(lookup_email text)
returns uuid
language sql
security definer
set search_path = auth
as $$
  select id
  from auth.users
  where lower(email) = lower(lookup_email)
  limit 1;
$$;

revoke all on function public.find_auth_user_id_by_email(text) from public;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;
