import { defineMiddleware } from "astro:middleware";
import {
  clearSessionCookies,
  setSessionCookies,
} from "./lib/cookies";
import { ensureCsrfToken } from "./lib/csrf";
import { createSupabaseClient } from "./lib/supabase";

const protectedRoutes = ["/dashboard", "/set-password"];
const redirectAuthenticatedFrom = ["/signin", "/register", "/forgot-password"];

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, redirect, url } = context;
  const pathname = url.pathname;

  // Always have a CSRF token available for forms rendered in this request.
  ensureCsrfToken(cookies);

  const accessToken = cookies.get("sb-access-token");
  const refreshToken = cookies.get("sb-refresh-token");
  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const isAuthPage = redirectAuthenticatedFrom.includes(pathname);

  if (!accessToken || !refreshToken) {
    if (isProtected) {
      return redirect("/signin");
    }
    return next();
  }

  // Per-request client so concurrent setSession calls cannot race.
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken.value,
    refresh_token: refreshToken.value,
  });

  if (error || !data.session) {
    clearSessionCookies(cookies);

    if (isProtected) {
      return redirect("/signin");
    }
    return next();
  }

  setSessionCookies(cookies, {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  context.locals.email = data.user?.email ?? null;
  context.locals.user = data.user;

  if (isAuthPage) {
    return redirect("/dashboard");
  }

  return next();
});
