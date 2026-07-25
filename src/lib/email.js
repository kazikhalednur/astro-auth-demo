import nodemailer from "nodemailer";

function isLocalSupabase() {
  const url = import.meta.env.SUPABASE_URL || "";
  return url.includes("127.0.0.1") || url.includes("localhost");
}

/**
 * @param {{ to: string, subject: string, text: string, html: string }} options
 */
async function deliverEmail({ to, subject, text, html }) {
  if (isLocalSupabase()) {
    console.log("\n========== AUTH EMAIL (local Supabase) ==========");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
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

  await transporter.sendMail({ from, to, subject, text, html });
}

/**
 * Deliver a magic login link.
 * @param {{ to: string, magicLink: string }} options
 */
export async function sendMagicLinkEmail({ to, magicLink }) {
  await deliverEmail({
    to,
    subject: "Your magic sign-in link",
    text: `Sign in with this link (expires soon):\n\n${magicLink}\n`,
    html: `<p>Sign in with this link (expires soon):</p><p><a href="${magicLink}">${magicLink}</a></p>`,
  });
}

/**
 * Deliver a password reset link.
 * @param {{ to: string, resetLink: string }} options
 */
export async function sendPasswordResetEmail({ to, resetLink }) {
  await deliverEmail({
    to,
    subject: "Reset your password",
    text: `Reset your password with this link (expires soon):\n\n${resetLink}\n\nIf you did not request this, you can ignore this email.\n`,
    html: `<p>Reset your password with this link (expires soon):</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}
