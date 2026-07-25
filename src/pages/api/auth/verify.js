export const prerender = false;

import { verifyMagicLinkToken } from "../../../lib/magic-link";
import {
  createSessionForEmail,
  ensureUserForMagicLink,
} from "../../../lib/supabase";

export const GET = async ({ url, cookies, redirect }) => {
  const token = url.searchParams.get("token");

  if (!token) {
    return redirect("/signin?error=invalid_or_expired_link");
  }

  try {
    const { email } = verifyMagicLinkToken(token);
    await ensureUserForMagicLink(email);
    const { access_token, refresh_token } = await createSessionForEmail(email);

    cookies.set("sb-access-token", access_token, { path: "/" });
    cookies.set("sb-refresh-token", refresh_token, { path: "/" });

    return redirect("/dashboard");
  } catch (error) {
    console.error("Magic link verify failed:", error);
    return redirect("/signin?error=invalid_or_expired_link");
  }
};
