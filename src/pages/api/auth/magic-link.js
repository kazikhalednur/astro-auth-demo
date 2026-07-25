export const prerender = false;

import { createMagicLinkToken } from "../../../lib/magic-link";
import { sendMagicLinkEmail } from "../../../lib/email";

export const POST = async ({ request, redirect }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString()?.trim();

  if (!email) {
    return redirect("/signin?error=email_required");
  }

  try {
    const token = createMagicLinkToken(email);
    const siteUrl = (
      import.meta.env.PUBLIC_SITE_URL || "http://localhost:4321"
    ).replace(/\/$/, "");
    const magicLink = `${siteUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

    await sendMagicLinkEmail({ to: email.toLowerCase(), magicLink });
  } catch (error) {
    console.error("Failed to send magic link:", error);
    return redirect("/signin?error=magic_link_failed");
  }

  return redirect("/signin?magic=sent");
};
