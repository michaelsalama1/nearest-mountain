/**
 * Cron (vercel.json): `45 1 * * *` = 01:45 UTC = 9:45 PM prior calendar evening in
 * America/New_York when EDT (UTC-4) is in effect. For 9:45 PM during EST, use `45 2 * * *`.
 * Production 10:00 AM Eastern was `0 14 * * *` (EDT) or `0 15 * * *` (EST).
 */
import { getGameCalendarDateYMD, getTomorrowGameCalendarDateYMD } from "../../../../lib/calendarDate";
import { getSnapshotForDateYMD } from "../../../../lib/challengeReadiness";
import { sendResendEmail } from "../../../../lib/sendResendEmail";

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function buildBody({ todayYmd, dateYmd, snap, testMode }) {
  const lines = [
    testMode
      ? "[TEST] Remove ?test=1 from the cron path in vercel.json when done (and fix the schedule)."
      : null,
    `Game calendar “today”: ${todayYmd}`,
    `Target “tomorrow” (game calendar): ${dateYmd}`,
    ``,
    `Title: ${snap.title || "(empty)"}`,
    `Image URL: ${snap.imageUrl || "(empty)"}`,
    `Latitude / longitude: ${
      snap.latitude != null && snap.longitude != null
        ? `${snap.latitude}, ${snap.longitude}`
        : "(none / invalid)"
    }`,
    ``,
    snap.gaps.length
      ? `Missing or incomplete: ${snap.gaps.join(", ")}`
      : `All required fields are present for that date.`
  ].filter(Boolean);
  return lines.join("\n");
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return Response.json(
      { error: "Set CRON_SECRET and send Authorization: Bearer <CRON_SECRET>." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const testMode =
    searchParams.get("test") === "1" || process.env.CRON_TEST_SEND_ALWAYS === "1";

  const todayYmd = getGameCalendarDateYMD();
  const dateYmd = getTomorrowGameCalendarDateYMD();
  const snap = await getSnapshotForDateYMD(dateYmd);

  if (snap.gaps.length === 0 && !testMode) {
    return Response.json({
      ok: true,
      gameDate: dateYmd,
      sent: false,
      message: "Tomorrow's challenge is complete; no email sent."
    });
  }

  const subject = testMode
    ? `[TEST] Summit Attempt — tomorrow ${dateYmd} snapshot`
    : snap.gaps.length
      ? `[Summit Attempt] Missing data for ${dateYmd} (tomorrow)`
      : `[Summit Attempt] ${dateYmd} — all set`;

  const text = buildBody({ todayYmd, dateYmd, snap, testMode });
  const finalText = testMode
    ? `${text}\n\n— Nearest Mountain gamemaster alert (test broadcast).`
    : snap.gaps.length
      ? `${text}\n\n— Nearest Mountain gamemaster alert (cron).`
      : `${text}\n\n— Nearest Mountain gamemaster alert (cron).`;

  const result = await sendResendEmail({ subject, text: finalText });

  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        gameDate: dateYmd,
        testMode,
        snapshot: snap,
        email: result
      },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    gameDate: dateYmd,
    testMode,
    gaps: snap.gaps,
    sent: true,
    resendId: result.id
  });
}
