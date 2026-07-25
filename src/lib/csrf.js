import { randomBytes, timingSafeEqual } from "node:crypto";
import { csrfCookieOptions } from "./cookies";

const CSRF_COOKIE = "csrf-token";

/**
 * Ensure a CSRF token cookie exists and return its value for hidden form fields.
 * @param {import("astro").AstroCookies} cookies
 * @returns {string}
 */
export function ensureCsrfToken(cookies) {
  const existing = cookies.get(CSRF_COOKIE)?.value;
  if (existing) {
    return existing;
  }

  const token = randomBytes(32).toString("base64url");
  cookies.set(CSRF_COOKIE, token, csrfCookieOptions());
  return token;
}

/**
 * Reject the request if the form token does not match the cookie.
 * @param {import("astro").AstroCookies} cookies
 * @param {FormData} formData
 * @returns {boolean}
 */
export function validateCsrf(cookies, formData) {
  const cookieToken = cookies.get(CSRF_COOKIE)?.value;
  const formToken = formData.get("csrf")?.toString();

  if (!cookieToken || !formToken) {
    return false;
  }

  const a = Buffer.from(cookieToken);
  const b = Buffer.from(formToken);
  return a.length === b.length && timingSafeEqual(a, b);
}
