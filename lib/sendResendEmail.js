const DEFAULT_ALERT_EMAIL = "michaelsalama19@gmail.com";

/**
 * @returns {{ ok: true, id?: string } | { ok: false, reason: string }}
 */
export async function sendResendEmail({ to, from, subject, text, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { ok: false, reason: "RESEND_API_KEY is not set" };
  }
  const toAddr = to || process.env.ALERT_EMAIL_TO || DEFAULT_ALERT_EMAIL;
  const fromAddr = from || process.env.ALERT_FROM_EMAIL;
  if (!fromAddr) {
    return { ok: false, reason: "ALERT_FROM_EMAIL (or from) is not set" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: fromAddr, to: [toAddr], subject, text, html: html || undefined })
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const errMsg =
      typeof data?.message === "string" ? data.message : Array.isArray(data?.message) ? data.message[0] : null;
    return { ok: false, reason: errMsg || `Resend HTTP ${res.status}` };
  }
  return { ok: true, id: data?.id };
}
