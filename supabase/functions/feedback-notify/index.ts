// feedback-notify — emails admin@thescholium.com when someone submits feedback.
//
// Called only by the `feedback_notify` AFTER INSERT trigger on public.feedback
// (database/migrations/20261122000000_feedback.sql) via pg_net. The daily cap
// lives in that trigger, not here: it sends kind "item" for the first N rows of a
// UTC day, one kind "overflow" notice for row N+1, and nothing after that. Every
// row is stored either way, so the cap only limits email, never feedback.
//
// JWT verification is off for this function (supabase/config.toml); instead the
// caller must present the shared secret in `x-webhook-secret`.
//
// Secrets (`supabase secrets set …`):
//   RESEND_API_KEY           — https://resend.com API key
//   FEEDBACK_WEBHOOK_SECRET  — must equal Vault secret `feedback_webhook_secret`
//   FEEDBACK_TO_EMAIL        — optional, default admin@thescholium.com
//   FEEDBACK_FROM_EMAIL      — optional, a sender on a Resend-verified domain

interface FeedbackRow {
  id: number;
  created_at: string;
  signed_in: boolean;
  app_key: string;
  source: string;
  category: string;
  rating: number | null;
  message: string | null;
  path: string | null;
  app_version: string | null;
  user_agent: string | null;
}

interface Payload {
  kind: "item" | "overflow";
  daily_cap: number;
  today_count: number;
  feedback: FeedbackRow;
}

const env = (k: string) => Deno.env.get(k) ?? "";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function compose(p: Payload): { subject: string; text: string } {
  const f = p.feedback;
  if (p.kind === "overflow") {
    return {
      subject: `[Scholium feedback] ${p.daily_cap}+ submissions today — alerts paused`,
      text:
        `More than ${p.daily_cap} feedback submissions have arrived today (UTC).\n` +
        `Email alerts are paused until tomorrow; every submission is still saved.\n\n` +
        `Read them in the admin dashboard → Feedback tab.`,
    };
  }
  const stars = f.rating ? `${"★".repeat(f.rating)}${"☆".repeat(5 - f.rating)} (${f.rating}/5)` : "—";
  const preview = (f.message ?? "").replace(/\s+/g, " ").slice(0, 60);
  return {
    subject: `[Scholium feedback] ${f.category} · ${f.app_key}${preview ? ` — ${preview}` : ""}`,
    text: [
      `App:       ${f.app_key}`,
      `Category:  ${f.category}`,
      `Rating:    ${stars}`,
      `Source:    ${f.source}`,
      `User:      ${f.signed_in ? "signed in" : "signed out"}`,
      `Page:      ${f.path ?? "—"}`,
      `Version:   ${f.app_version ?? "—"}`,
      `Browser:   ${f.user_agent ?? "—"}`,
      `When:      ${f.created_at}`,
      `Today:     ${p.today_count} of ${p.daily_cap} alerts`,
      ``,
      f.message ?? "(no message — rating only)",
      ``,
      `— Feedback #${f.id}. Triage it in the admin dashboard → Feedback tab.`,
    ].join("\n"),
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const secret = env("FEEDBACK_WEBHOOK_SECRET");
  if (!secret || !timingSafeEqual(req.headers.get("x-webhook-secret") ?? "", secret)) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  if (!payload?.feedback || (payload.kind !== "item" && payload.kind !== "overflow")) {
    return new Response("bad payload", { status: 400 });
  }

  const apiKey = env("RESEND_API_KEY");
  if (!apiKey) return new Response("RESEND_API_KEY unset", { status: 500 });

  const { subject, text } = compose(payload);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env("FEEDBACK_FROM_EMAIL") || "Scholium Feedback <feedback@thescholium.com>",
      to: [env("FEEDBACK_TO_EMAIL") || "admin@thescholium.com"],
      subject,
      text, // plain text only: user-supplied content is never rendered as HTML
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("resend failed", res.status, body.slice(0, 500));
    return new Response("send failed", { status: 502 });
  }
  return new Response("ok");
});
