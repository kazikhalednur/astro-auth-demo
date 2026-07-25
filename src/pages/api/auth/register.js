export const prerender = false;

import { validateCsrf } from "../../../lib/csrf";
import { checkRateLimit } from "../../../lib/rate-limit";
import { createSupabaseClient } from "../../../lib/supabase";
import { validateEmail, validatePassword } from "../../../lib/validation";

export const POST = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();

  if (!validateCsrf(cookies, formData)) {
    return redirect("/register?error=csrf");
  }

  const emailResult = validateEmail(formData.get("email")?.toString());
  if (!emailResult.ok) {
    return redirect(`/register?error=${emailResult.error}`);
  }

  const passwordResult = validatePassword(formData.get("password")?.toString());
  if (!passwordResult.ok) {
    return redirect(`/register?error=${passwordResult.error}`);
  }

  const { email } = emailResult;
  const { password } = passwordResult;

  const rate = await checkRateLimit(`register:${email}`, {
    limit: 5,
    windowSeconds: 15 * 60,
  });
  if (!rate.allowed) {
    return redirect("/register?error=rate_limited");
  }

  const supabase = createSupabaseClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { needs_password: false },
    },
  });

  if (error) {
    const message = (error.message || "").toLowerCase();
    if (
      message.includes("already") ||
      error.code === "user_already_exists" ||
      error.code === "email_exists"
    ) {
      return redirect("/register?error=email_taken");
    }
    console.error("Register failed:", error);
    return redirect("/register?error=register_failed");
  }

  return redirect("/signin?registered=1");
};
