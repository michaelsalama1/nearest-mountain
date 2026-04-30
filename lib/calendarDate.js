/**
 * Calendar date (YYYY-MM-DD) for the daily game in a single IANA timezone.
 * Using UTC (toISOString) caused “tomorrow’s” challenge to show for US users
 * when the server clock had already passed midnight UTC.
 *
 * Set NEXT_PUBLIC_GAME_DAILY_TIMEZONE (or GAME_DAILY_TIMEZONE on the server) to
 * the zone your puzzle authors use (default US Pacific).
 */

const DEFAULT_GAME_DAILY_TIMEZONE = "America/Los_Angeles";

export function getGameDailyTimeZone() {
  if (typeof process === "undefined" || !process?.env) {
    return DEFAULT_GAME_DAILY_TIMEZONE;
  }
  return (
    process.env.NEXT_PUBLIC_GAME_DAILY_TIMEZONE ||
    process.env.GAME_DAILY_TIMEZONE ||
    DEFAULT_GAME_DAILY_TIMEZONE
  );
}

/**
 * @returns {string} YYYY-MM-DD in the game’s timezone
 */
export function getGameCalendarDateYMD() {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: getGameDailyTimeZone()
  });
}

/**
 * @param {string} timeZone IANA timezone (e.g. America/New_York)
 * @returns {string} YYYY-MM-DD in provided timezone, or game default if invalid
 */
export function getCalendarDateYMDForTimeZone(timeZone) {
  const zone = String(timeZone || "").trim();
  if (!zone) return getGameCalendarDateYMD();
  try {
    return new Date().toLocaleDateString("sv-SE", { timeZone: zone });
  } catch {
    return getGameCalendarDateYMD();
  }
}

/**
 * @param {string} ymd YYYY-MM-DD
 * @param {number} n days to add (can be negative)
 * @returns {string} YYYY-MM-DD (Gregorian, civil calendar; matches game “wall clock” day labels)
 */
export function addCalendarDaysYMD(ymd, n) {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return ymd;
  }
  const u = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  u.setUTCDate(u.getUTCDate() + n);
  return u.toISOString().slice(0, 10);
}

/** The calendar day *after* “today” in the game’s IANA zone. */
export function getTomorrowGameCalendarDateYMD() {
  return addCalendarDaysYMD(getGameCalendarDateYMD(), 1);
}
