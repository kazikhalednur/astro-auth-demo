import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

export const supabase = createClient(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_ANON_KEY,
);

export const supabaseAdmin = createClient(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
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
 * Existing users keep their password unchanged.
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
 * Create a Supabase session for an email without sending Supabase's own email.
 * @param {string} email
 * @returns {Promise<{ access_token: string, refresh_token: string }>}
 */
export async function createSessionForEmail(email) {
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

  const { data: sessionData, error: otpError } = await supabase.auth.verifyOtp({
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
