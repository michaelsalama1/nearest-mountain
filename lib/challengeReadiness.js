import { readChallenges } from "./gameChallenges";

function normalizeChallenge(challenge, date) {
  if (!challenge) return null;
  if (Array.isArray(challenge.rounds)) {
    return challenge;
  }
  return {
    id: challenge.id || date,
    rounds: [
      {
        title: challenge.title || "",
        description: challenge.description || "",
        imageUrl: challenge.imageUrl || "",
        hint: challenge.hint || "",
        latitude: Number(challenge.latitude),
        longitude: Number(challenge.longitude)
      }
    ]
  };
}

/**
 * @returns {string[]} list of user-facing issues (empty if the round is ready to publish)
 */
export function getDailyRoundGaps(round) {
  if (!round) {
    return ["no challenge for this day"];
  }
  const missing = [];
  if (!String(round.title ?? "").trim()) {
    missing.push("title");
  }
  if (!String(round.imageUrl ?? "").trim()) {
    missing.push("image URL");
  }
  const lat = Number(round.latitude);
  const lon = Number(round.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    missing.push("latitude/longitude (invalid numbers)");
  } else {
    if (Math.abs(lat) < 1e-9 && Math.abs(lon) < 1e-9) {
      missing.push("coordinates (still at 0,0 placeholder; set a real peak)");
    } else if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      missing.push("latitude/longitude (out of range)");
    }
  }
  return missing;
}

export async function getGapsForDateYMD(dateYmd) {
  const challenges = await readChallenges();
  const ch = challenges[dateYmd];
  const norm = normalizeChallenge(ch, dateYmd);
  const first = norm?.rounds?.[0] ?? null;
  return { gaps: getDailyRoundGaps(first) };
}

/** Full snapshot for alert emails (title, URLs, coords, gap list). */
export async function getSnapshotForDateYMD(dateYmd) {
  const challenges = await readChallenges();
  const ch = challenges[dateYmd];
  const norm = normalizeChallenge(ch, dateYmd);
  const first = norm?.rounds?.[0] ?? null;
  const gaps = getDailyRoundGaps(first);
  return {
    gaps,
    title: first ? String(first.title ?? "").trim() : "",
    imageUrl: first ? String(first.imageUrl ?? "").trim() : "",
    latitude: first != null && !Number.isNaN(Number(first.latitude)) ? Number(first.latitude) : null,
    longitude: first != null && !Number.isNaN(Number(first.longitude)) ? Number(first.longitude) : null
  };
}
