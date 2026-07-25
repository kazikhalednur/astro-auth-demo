export const prerender = false;

import { validateCsrf } from "../../../lib/csrf";
import { verifyPasswordResetToken } from "../../../lib/magic-link";
import {
  findUserIdByEmail,
  setUserPassword,
} from "../../../lib/supabase";
import { validatePassword } from "../../../lib/validation";

export const POST = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();

  if (!validateCsrf(cookies, formData)) {
    return redirect("/forgot-password?error=csrf");
  }

  const token = formData.get("token")?.toString();
  if (!token) {
    return redirect("/forgot-password?error=invalid_reset_link");
  }

  const passwordResult = validatePassword(formData.get("password")?.toString());
  if (!passwordResult.ok) {
    return redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=${passwordResult.error}`,
    );
  }

  const confirm = formData.get("confirm")?.toString() || "";
  if (confirm !== passwordResult.password) {
    return redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=password_mismatch`,
    );
  }

  try {
    const { email } = await verifyPasswordResetToken(token);
    const userId = await findUserIdByEmail(email);
    if (!userId) {
      return redirect("/forgot-password?error=invalid_reset_link");
    }

    await setUserPassword(userId, passwordResult.password);
    return redirect("/signin?password_reset=1");
  } catch (error) {
    console.error("Password reset failed:", error);
    return redirect("/forgot-password?error=invalid_reset_link");
  }
};
