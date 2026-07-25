import { defineMiddleware } from "astro:middleware";
import { supabase } from "./lib/supabase";

const protectedRoutes = ["/dashboard"];
const redirectAuthenticatedFrom = ["/signin", "/register"];

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, redirect, url } = context;
  const pathname = url.pathname;

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

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken.value,
    refresh_token: refreshToken.value,
  });

  if (error || !data.session) {
    cookies.delete("sb-access-token", { path: "/" });
    cookies.delete("sb-refresh-token", { path: "/" });

    if (isProtected) {
      return redirect("/signin");
    }
    return next();
  }

  cookies.set("sb-access-token", data.session.access_token, { path: "/" });
  cookies.set("sb-refresh-token", data.session.refresh_token, { path: "/" });

  context.locals.email = data.user?.email ?? null;
  context.locals.user = data.user;

  if (isAuthPage) {
    return redirect("/dashboard");
  }

  return next();
});
