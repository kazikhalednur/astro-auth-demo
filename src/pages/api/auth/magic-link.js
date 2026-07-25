export const prerender = false;

import { validateCsrf } from "../../../lib/csrf";
import { sendMagicLinkEmail } from "../../../lib/email";
import {
  buildMagicLinkUrl,
  createMagicLinkToken,
} from "../../../lib/magic-link";
import { checkRateLimit } from "../../../lib/rate-limit";
import { validateEmail } from "../../../lib/validation";

export const POST = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();

  if (!validateCsrf(cookies, formData)) {
    return redirect("/signin?error=csrf");
  }

  const emailResult = validateEmail(formData.get("email")?.toString());
  if (!emailResult.ok) {
    return redirect(`/signin?error=${emailResult.error}`);
  }

  const { email } = emailResult;
  const rate = await checkRateLimit(`magic_link:${email}`, {
    limit: 5,
    windowSeconds: 15 * 60,
  });
  if (!rate.allowed) {
    return redirect("/signin?error=rate_limited");
  }

  try {
    const token = await createMagicLinkToken(email);
    const magicLink = buildMagicLinkUrl(token);
    await sendMagicLinkEmail({ to: email, magicLink });
  } catch (error) {
    console.error("Failed to send magic link:", error);
    return redirect("/signin?error=magic_link_failed");
  }

  return redirect("/signin?magic=sent");
};
