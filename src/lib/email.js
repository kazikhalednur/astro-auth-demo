import nodemailer from "nodemailer";

function isLocalSupabase() {
  const url = import.meta.env.SUPABASE_URL || "";
  return url.includes("127.0.0.1") || url.includes("localhost");
}

/**
 * Deliver a magic login link.
 * Local Supabase: log to console.
 * Production: send via SMTP (Supabase project SMTP settings).
 * @param {{ to: string, magicLink: string }} options
 */
export async function sendMagicLinkEmail({ to, magicLink }) {
  if (isLocalSupabase()) {
    console.log("\n========== MAGIC LINK (local Supabase) ==========");
    console.log(`To: ${to}`);
    console.log(`Link: ${magicLink}`);
    console.log("=================================================\n");
    return;
  }

  const host = import.meta.env.SMTP_HOST;
  const port = Number.parseInt(import.meta.env.SMTP_PORT || "587", 10);
  const user = import.meta.env.SMTP_USER;
  const pass = import.meta.env.SMTP_PASS;
  const from = import.meta.env.EMAIL_FROM;

  if (!host || !from) {
    throw new Error(
      "Production SMTP is not configured. Set SMTP_HOST and EMAIL_FROM (and usually SMTP_USER / SMTP_PASS).",
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  await transporter.sendMail({
    from,
    to,
    subject: "Your magic sign-in link",
    text: `Sign in with this link (expires soon):\n\n${magicLink}\n`,
    html: `<p>Sign in with this link (expires soon):</p><p><a href="${magicLink}">${magicLink}</a></p>`,
  });
}
