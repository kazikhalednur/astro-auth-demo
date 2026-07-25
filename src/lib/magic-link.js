import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const usedJtis = new Set();

export class MagicLinkExpiredError extends Error {
  /**
   * @param {string} email
   */
  constructor(email) {
    super("Magic link has expired");
    this.name = "MagicLinkExpiredError";
    this.code = "MAGIC_LINK_EXPIRED";
    this.email = email;
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
  const raw = import.meta.env.MAGIC_LINK_EXPIRY_SECONDS;
  const parsed = Number.parseInt(raw || "300", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
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
 * Create a signed, expiring magic-link token for an email.
 * @param {string} email
 * @returns {string}
 */
export function createMagicLinkToken(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const payload = {
    email: normalizedEmail,
    exp: Math.floor(Date.now() / 1000) + getExpirySeconds(),
    jti: randomBytes(16).toString("hex"),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Build the absolute magic-link URL for a token.
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
 * Verify a magic-link token. Throws if invalid, expired, or already used.
 * Expired tokens throw MagicLinkExpiredError with the email so a new link can be sent.
 * @param {string} token
 * @returns {{ email: string, jti: string, exp: number }}
 */
export function verifyMagicLinkToken(token) {
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

  /** @type {{ email?: string, exp?: number, jti?: string }} */
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    throw new Error("Invalid magic link payload");
  }

  if (!payload.email || !payload.exp || !payload.jti) {
    throw new Error("Invalid magic link payload");
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new MagicLinkExpiredError(payload.email);
  }

  if (usedJtis.has(payload.jti)) {
    throw new Error("Magic link has already been used");
  }

  usedJtis.add(payload.jti);
  return {
    email: payload.email,
    jti: payload.jti,
    exp: payload.exp,
  };
}
