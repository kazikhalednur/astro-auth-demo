export const prerender = false;

import { setSessionCookies } from "../../../lib/cookies";
import { sendMagicLinkEmail } from "../../../lib/email";
import {
  MagicLinkExpiredError,
  buildMagicLinkUrl,
  createMagicLinkToken,
  verifyMagicLinkToken,
} from "../../../lib/magic-link";
import { checkRateLimit } from "../../../lib/rate-limit";
import {
  createSessionForEmail,
  ensureUserForMagicLink,
} from "../../../lib/supabase";

/**
 * @param {string} email
 */
async function resendMagicLink(email) {
  const token = await createMagicLinkToken(email);
  const magicLink = buildMagicLinkUrl(token);
  await sendMagicLinkEmail({ to: email.toLowerCase(), magicLink });
}

export const GET = async ({ url, cookies, redirect }) => {
  const token = url.searchParams.get("token");

  if (!token) {
    return redirect("/signin?error=invalid_or_expired_link");
  }

  try {
    const { email } = await verifyMagicLinkToken(token);
    await ensureUserForMagicLink(email);
    const session = await createSessionForEmail(email);
    setSessionCookies(cookies, session);
    return redirect("/dashboard");
  } catch (error) {
    const isExpired =
      error instanceof MagicLinkExpiredError ||
      error?.code === "MAGIC_LINK_EXPIRED";

    if (isExpired && error.email) {
      const rate = await checkRateLimit(`magic_link:${error.email}`, {
        limit: 5,
        windowSeconds: 15 * 60,
      });
      if (!rate.allowed) {
        return redirect("/signin?error=rate_limited");
      }

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
