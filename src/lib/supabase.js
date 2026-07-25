import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

function env(name) {
  return import.meta.env[name] || "";
}

/**
 * Fresh anon client per call — avoids shared-session races under concurrent requests.
 */
export function createSupabaseClient() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const supabaseAdmin = createClient(
  env("SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

function isExistingUserError(error) {
  const message = (error?.message || "").toLowerCase();
  const code = (error?.code || "").toLowerCase();
  return (
    code === "email_exists" ||
    code === "user_already_exists" ||
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("user already exists")
  );
}

/**
 * Find an Auth user by email, or create one with a random password.
 * New magic-link users are flagged so they can set a password later.
 * @param {string} email
 * @returns {Promise<{ email: string, created: boolean }>}
 */
export async function ensureUserForMagicLink(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const randomPassword = randomBytes(32).toString("base64url");

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password: randomPassword,
    email_confirm: true,
    user_metadata: { needs_password: true },
  });

  if (!error && data.user) {
    return { email: normalizedEmail, created: true };
  }

  if (error && isExistingUserError(error)) {
    return { email: normalizedEmail, created: false };
  }

  throw error || new Error("Failed to ensure user for magic link");
}

/**
 * Look up a user id by email via a security-definer DB function.
 * @param {string} email
 * @returns {Promise<string | null>}
 */
export async function findUserIdByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabaseAdmin.rpc(
    "find_auth_user_id_by_email",
    { lookup_email: normalizedEmail },
  );

  if (error) {
    throw error;
  }

  return data ?? null;
}

/**
 * Set a password for a user and clear the needs_password flag.
 * @param {string} userId
 * @param {string} password
 */
export async function setUserPassword(userId, password) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password,
    user_metadata: { needs_password: false },
  });

  if (error) {
    throw error;
  }
}

/**
 * Create a Supabase session for an email without sending Supabase's own email.
 * @param {string} email
 * @returns {Promise<{ access_token: string, refresh_token: string }>}
 */
export async function createSessionForEmail(email) {
  const client = createSupabaseClient();

  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email.trim().toLowerCase(),
    });

  if (linkError) {
    throw linkError;
  }

  const tokenHash = linkData?.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error("Failed to generate session token");
  }

  const { data: sessionData, error: otpError } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  if (otpError) {
    throw otpError;
  }

  const session = sessionData?.session;
  if (!session?.access_token || !session?.refresh_token) {
    throw new Error("Failed to create session");
  }

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  };
}
