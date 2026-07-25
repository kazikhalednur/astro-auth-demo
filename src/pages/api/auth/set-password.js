export const prerender = false;

import { validateCsrf } from "../../../lib/csrf";
import { setUserPassword } from "../../../lib/supabase";
import { validatePassword } from "../../../lib/validation";

export const POST = async ({ request, cookies, redirect, locals }) => {
  const formData = await request.formData();

  if (!validateCsrf(cookies, formData)) {
    return redirect("/set-password?error=csrf");
  }

  const user = locals.user;
  if (!user?.id) {
    return redirect("/signin");
  }

  const passwordResult = validatePassword(formData.get("password")?.toString());
  if (!passwordResult.ok) {
    return redirect(`/set-password?error=${passwordResult.error}`);
  }

  const confirm = formData.get("confirm")?.toString() || "";
  if (confirm !== passwordResult.password) {
    return redirect("/set-password?error=password_mismatch");
  }

  try {
    await setUserPassword(user.id, passwordResult.password);
    return redirect("/dashboard?password_set=1");
  } catch (error) {
    console.error("Set password failed:", error);
    return redirect("/set-password?error=set_password_failed");
  }
};
