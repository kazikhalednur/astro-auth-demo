const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * @param {string | null | undefined} email
 * @returns {{ ok: true, email: string } | { ok: false, error: string }}
 */
export function validateEmail(email) {
  const normalized = email?.trim().toLowerCase() || "";
  if (!normalized) {
    return { ok: false, error: "email_required" };
  }
  if (!EMAIL_RE.test(normalized)) {
    return { ok: false, error: "email_invalid" };
  }
  return { ok: true, email: normalized };
}

/**
 * @param {string | null | undefined} password
 * @returns {{ ok: true, password: string } | { ok: false, error: string }}
 */
export function validatePassword(password) {
  if (!password) {
    return { ok: false, error: "password_required" };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: "password_too_short" };
  }
  return { ok: true, password };
}

export { MIN_PASSWORD_LENGTH };
