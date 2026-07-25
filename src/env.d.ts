/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly MAGIC_LINK_SECRET: string;
  readonly MAGIC_LINK_EXPIRY_SECONDS?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly SMTP_HOST?: string;
  readonly SMTP_PORT?: string;
  readonly SMTP_USER?: string;
  readonly SMTP_PASS?: string;
  readonly EMAIL_FROM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    email: string | null;
    user: import("@supabase/supabase-js").User | undefined;
  }
}
