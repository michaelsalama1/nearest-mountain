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
