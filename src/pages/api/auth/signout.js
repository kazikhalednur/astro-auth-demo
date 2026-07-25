export const prerender = false;

import { clearSessionCookies } from "../../../lib/cookies";
import { validateCsrf } from "../../../lib/csrf";
import { createSupabaseClient } from "../../../lib/supabase";

export const POST = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();

  if (!validateCsrf(cookies, formData)) {
    return redirect("/signin?error=csrf");
  }

  const accessToken = cookies.get("sb-access-token")?.value;
  const refreshToken = cookies.get("sb-refresh-token")?.value;

  if (accessToken && refreshToken) {
    try {
      const supabase = createSupabaseClient();
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Supabase sign-out failed:", error);
    }
  }

  clearSessionCookies(cookies);
  return redirect("/signin?signed_out=1");
};
