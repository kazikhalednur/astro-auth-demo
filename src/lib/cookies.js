/**
 * Session cookie options for Supabase access/refresh tokens.
 * httpOnly keeps tokens out of document.cookie (XSS mitigation).
 */
export function sessionCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}

/**
 * CSRF cookie: readable by the server when rendering forms, not by third-party sites (SameSite).
 */
export function csrfCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
  };
}

/**
 * @param {import("astro").AstroCookies} cookies
 * @param {{ access_token: string, refresh_token: string }} session
 */
export function setSessionCookies(cookies, session) {
  const options = sessionCookieOptions();
  cookies.set("sb-access-token", session.access_token, options);
  cookies.set("sb-refresh-token", session.refresh_token, options);
}

/**
 * @param {import("astro").AstroCookies} cookies
 */
export function clearSessionCookies(cookies) {
  cookies.delete("sb-access-token", { path: "/" });
  cookies.delete("sb-refresh-token", { path: "/" });
}
