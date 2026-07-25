export const prerender = false;

import { validateCsrf } from "../../../lib/csrf";
import { sendPasswordResetEmail } from "../../../lib/email";
import {
  buildPasswordResetUrl,
  createPasswordResetToken,
} from "../../../lib/magic-link";
import { checkRateLimit } from "../../../lib/rate-limit";
import { findUserIdByEmail } from "../../../lib/supabase";
import { validateEmail } from "../../../lib/validation";

export const POST = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();

  if (!validateCsrf(cookies, formData)) {
    return redirect("/forgot-password?error=csrf");
  }

  const emailResult = validateEmail(formData.get("email")?.toString());
  if (!emailResult.ok) {
    return redirect(`/forgot-password?error=${emailResult.error}`);
  }

  const { email } = emailResult;
  const rate = await checkRateLimit(`password_reset:${email}`, {
    limit: 5,
    windowSeconds: 15 * 60,
  });
  if (!rate.allowed) {
    return redirect("/forgot-password?error=rate_limited");
  }

  // Always show the same success message to avoid email enumeration.
  try {
    const userId = await findUserIdByEmail(email);
    if (userId) {
      const token = await createPasswordResetToken(email);
      const resetLink = buildPasswordResetUrl(token);
      await sendPasswordResetEmail({ to: email, resetLink });
    }
  } catch (error) {
    console.error("Password reset request failed:", error);
    return redirect("/forgot-password?error=reset_failed");
  }

  return redirect("/forgot-password?sent=1");
};
