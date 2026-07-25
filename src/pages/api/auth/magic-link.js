export const prerender = false;

import { sendMagicLinkEmail } from "../../../lib/email";
import {
  buildMagicLinkUrl,
  createMagicLinkToken,
} from "../../../lib/magic-link";

export const POST = async ({ request, redirect }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString()?.trim();

  if (!email) {
    return redirect("/signin?error=email_required");
  }

  try {
    const token = createMagicLinkToken(email);
    const magicLink = buildMagicLinkUrl(token);
    await sendMagicLinkEmail({ to: email.toLowerCase(), magicLink });
  } catch (error) {
    console.error("Failed to send magic link:", error);
    return redirect("/signin?error=magic_link_failed");
  }

  return redirect("/signin?magic=sent");
};
