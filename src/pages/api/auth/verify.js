export const prerender = false;

import { sendMagicLinkEmail } from "../../../lib/email";
import {
  MagicLinkExpiredError,
  buildMagicLinkUrl,
  createMagicLinkToken,
  verifyMagicLinkToken,
} from "../../../lib/magic-link";
import {
  createSessionForEmail,
  ensureUserForMagicLink,
} from "../../../lib/supabase";

/**
 * Issue and deliver a fresh magic link for an email.
 * @param {string} email
 */
async function resendMagicLink(email) {
  const token = createMagicLinkToken(email);
  const magicLink = buildMagicLinkUrl(token);
  await sendMagicLinkEmail({ to: email.toLowerCase(), magicLink });
}

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
    const isExpired =
      error instanceof MagicLinkExpiredError ||
      error?.code === "MAGIC_LINK_EXPIRED";

    if (isExpired && error.email) {
      try {
        await resendMagicLink(error.email);
        return redirect("/signin?magic=resent");
      } catch (resendError) {
        console.error("Failed to resend magic link after expiry:", resendError);
        return redirect("/signin?error=magic_link_failed");
      }
    }

    console.error("Magic link verify failed:", error);
    return redirect("/signin?error=invalid_or_expired_link");
  }
};
