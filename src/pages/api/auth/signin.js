export const prerender = false;

import { setSessionCookies } from "../../../lib/cookies";
import { validateCsrf } from "../../../lib/csrf";
import { checkRateLimit } from "../../../lib/rate-limit";
import { createSupabaseClient } from "../../../lib/supabase";
import { validateEmail, validatePassword } from "../../../lib/validation";

export const POST = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();

  if (!validateCsrf(cookies, formData)) {
    return redirect("/signin?error=csrf");
  }

  const emailResult = validateEmail(formData.get("email")?.toString());
  if (!emailResult.ok) {
    return redirect(`/signin?error=${emailResult.error}`);
  }

  const passwordResult = validatePassword(formData.get("password")?.toString());
  if (!passwordResult.ok) {
    return redirect(`/signin?error=${passwordResult.error}`);
  }

  const { email } = emailResult;
  const { password } = passwordResult;

  const rate = await checkRateLimit(`signin:${email}`, {
    limit: 10,
    windowSeconds: 15 * 60,
  });
  if (!rate.allowed) {
    return redirect("/signin?error=rate_limited");
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    // Generic message — avoid leaking whether the email exists.
    return redirect("/signin?error=invalid_credentials");
  }

  setSessionCookies(cookies, {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  return redirect("/dashboard");
};
