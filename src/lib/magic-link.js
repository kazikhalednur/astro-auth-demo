import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "./supabase";

export class MagicLinkExpiredError extends Error {
  /**
   * @param {string} email
   * @param {string} [purpose]
   */
  constructor(email, purpose = "magic_link") {
    super("Magic link has expired");
    this.name = "MagicLinkExpiredError";
    this.code = "MAGIC_LINK_EXPIRED";
    this.email = email;
    this.purpose = purpose;
  }
}

function getSecret() {
  const secret = import.meta.env.MAGIC_LINK_SECRET;
  if (!secret) {
    throw new Error("MAGIC_LINK_SECRET is not configured");
  }
  return secret;
}

function getExpirySeconds() {
  // Prefer process.env so .env edits are not stuck behind a stale Vite inline.
  const raw =
    process.env.MAGIC_LINK_EXPIRY_SECONDS ||
    import.meta.env.MAGIC_LINK_EXPIRY_SECONDS ||
    "900";
  const parsed = Number.parseInt(String(raw).trim(), 10);
  // Ignore zero/negative/absurdly short values from misconfiguration.
  if (!Number.isFinite(parsed) || parsed < 60) {
    return 900;
  }
  return parsed;
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/**
 * @param {string} email
 * @param {"magic_link" | "password_reset"} [purpose]
 * @returns {Promise<string>}
 */
export async function createSignedAuthToken(email, purpose = "magic_link") {
  const normalizedEmail = email.trim().toLowerCase();
  const exp = Math.floor(Date.now() / 1000) + getExpirySeconds();
  const jti = randomBytes(16).toString("hex");
  const payload = { email: normalizedEmail, exp, jti, purpose };

  const { error } = await supabaseAdmin.from("magic_link_tokens").insert({
    jti,
    email: normalizedEmail,
    purpose,
    expires_at: new Date(exp * 1000).toISOString(),
  });

  if (error) {
    throw error;
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * @param {string} email
 * @returns {Promise<string>}
 */
export function createMagicLinkToken(email) {
  return createSignedAuthToken(email, "magic_link");
}

/**
 * @param {string} email
 * @returns {Promise<string>}
 */
export function createPasswordResetToken(email) {
  return createSignedAuthToken(email, "password_reset");
}

/**
 * @param {string} token
 * @returns {string}
 */
export function buildMagicLinkUrl(token) {
  const siteUrl = (
    import.meta.env.PUBLIC_SITE_URL || "http://localhost:4321"
  ).replace(/\/$/, "");
  return `${siteUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
}

/**
 * @param {string} token
 * @returns {string}
 */
export function buildPasswordResetUrl(token) {
  const siteUrl = (
    import.meta.env.PUBLIC_SITE_URL || "http://localhost:4321"
  ).replace(/\/$/, "");
  return `${siteUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Parse and cryptographically verify a token without consuming the JTI.
 * @param {string} token
 * @returns {{ email: string, jti: string, exp: number, purpose: string }}
 */
function parseSignedToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    throw new Error("Invalid magic link token");
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Invalid magic link token");
  }

  const expected = sign(encodedPayload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);

  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    throw new Error("Invalid magic link signature");
  }

  /** @type {{ email?: string, exp?: number, jti?: string, purpose?: string }} */
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    throw new Error("Invalid magic link payload");
  }

  if (!payload.email || !payload.exp || !payload.jti) {
    throw new Error("Invalid magic link payload");
  }

  const purpose = payload.purpose || "magic_link";

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new MagicLinkExpiredError(payload.email, purpose);
  }

  return {
    email: payload.email,
    jti: payload.jti,
    exp: payload.exp,
    purpose,
  };
}

/**
 * Atomically mark a JTI as used. Returns false if missing, expired in DB, or already used.
 * @param {string} jti
 * @param {string} purpose
 * @returns {Promise<boolean>}
 */
async function consumeJti(jti, purpose) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("magic_link_tokens")
    .update({ used_at: now })
    .eq("jti", jti)
    .eq("purpose", purpose)
    .is("used_at", null)
    .gt("expires_at", now)
    .select("jti")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.jti);
}

/**
 * Verify a magic-link token and consume its one-time JTI.
 * @param {string} token
 * @returns {Promise<{ email: string, jti: string, exp: number }>}
 */
export async function verifyMagicLinkToken(token) {
  const payload = parseSignedToken(token);

  if (payload.purpose !== "magic_link") {
    throw new Error("Invalid magic link purpose");
  }

  const consumed = await consumeJti(payload.jti, "magic_link");
  if (!consumed) {
    throw new Error("Magic link has already been used or is invalid");
  }

  return {
    email: payload.email,
    jti: payload.jti,
    exp: payload.exp,
  };
}

/**
 * Verify a password-reset token and consume its one-time JTI.
 * @param {string} token
 * @returns {Promise<{ email: string, jti: string, exp: number }>}
 */
export async function verifyPasswordResetToken(token) {
  const payload = parseSignedToken(token);

  if (payload.purpose !== "password_reset") {
    throw new Error("Invalid password reset purpose");
  }

  const consumed = await consumeJti(payload.jti, "password_reset");
  if (!consumed) {
    throw new Error("Password reset link has already been used or is invalid");
  }

  return {
    email: payload.email,
    jti: payload.jti,
    exp: payload.exp,
  };
}

/**
 * Peek at a password-reset token without consuming it (for rendering the form).
 * @param {string} token
 * @returns {Promise<{ email: string, jti: string, exp: number }>}
 */
export async function peekPasswordResetToken(token) {
  const payload = parseSignedToken(token);
  if (payload.purpose !== "password_reset") {
    throw new Error("Invalid password reset purpose");
  }

  const { data, error } = await supabaseAdmin
    .from("magic_link_tokens")
    .select("used_at")
    .eq("jti", payload.jti)
    .eq("purpose", "password_reset")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || data.used_at) {
    throw new Error("Password reset link has already been used or is invalid");
  }

  return {
    email: payload.email,
    jti: payload.jti,
    exp: payload.exp,
  };
}
