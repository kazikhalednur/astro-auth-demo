import { supabaseAdmin } from "./supabase";

/**
 * Fixed-window rate limit backed by Supabase (service role).
 * @param {string} bucket unique key, e.g. "magic_link:user@example.com"
 * @param {{ limit?: number, windowSeconds?: number }} [options]
 * @returns {Promise<{ allowed: boolean, retryAfterSeconds?: number }>}
 */
export async function checkRateLimit(
  bucket,
  { limit = 5, windowSeconds = 15 * 60 } = {},
) {
  const now = new Date();
  const { data: existing, error: readError } = await supabaseAdmin
    .from("auth_rate_limits")
    .select("count, window_start")
    .eq("bucket", bucket)
    .maybeSingle();

  if (readError) {
    console.error("Rate limit read failed:", readError);
    // Fail open so a DB blip does not lock everyone out of auth.
    return { allowed: true };
  }

  const windowStart = existing?.window_start
    ? new Date(existing.window_start)
    : null;
  const windowExpired =
    !windowStart ||
    now.getTime() - windowStart.getTime() >= windowSeconds * 1000;

  if (!existing || windowExpired) {
    const { error: upsertError } = await supabaseAdmin
      .from("auth_rate_limits")
      .upsert({
        bucket,
        count: 1,
        window_start: now.toISOString(),
      });

    if (upsertError) {
      console.error("Rate limit upsert failed:", upsertError);
    }
    return { allowed: true };
  }

  if (existing.count >= limit) {
    const elapsedMs = now.getTime() - windowStart.getTime();
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(windowSeconds - elapsedMs / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }

  const { error: updateError } = await supabaseAdmin
    .from("auth_rate_limits")
    .update({ count: existing.count + 1 })
    .eq("bucket", bucket);

  if (updateError) {
    console.error("Rate limit update failed:", updateError);
  }

  return { allowed: true };
}
