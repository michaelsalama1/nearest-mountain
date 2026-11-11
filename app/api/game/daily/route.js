import { getTodayIsoDate, readChallenges } from "../../../../lib/gameChallenges";
import { getDailyRoundGaps } from "../../../../lib/challengeReadiness";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Last resort when there are no past challenges to recycle (old behavior). */
function pickFallbackChallenge(challenges) {
  const dates = Object.keys(challenges).sort();
  if (!dates.length) return null;
  const latestDate = dates[dates.length - 1];
  return { date: latestDate, challenge: challenges[latestDate] };
}

/** Small deterministic PRNG so every player gets the same pick for a given day. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * No challenge scheduled for `date`: recycle a past one. Candidates are dated
 * entries before `date` that are complete (title, image, real coordinates).
 * Picks walk a fixed seeded shuffle of the pool, so every past challenge comes
 * up once before any repeats, and the pick is the same for everyone all day.
 */
function pickReplayChallenge(challenges, date) {
  if (!YMD.test(date)) return null;
  const pool = Object.keys(challenges)
    .filter((d) => YMD.test(d) && d < date)
    .filter((d) => {
      const round = normalizeChallenge(challenges[d], d)?.rounds?.[0];
      return getDailyRoundGaps(round).length === 0;
    })
    .sort();
  if (!pool.length) return null;

  // One fixed shuffled order, walked one step per day: each past challenge
  // returns exactly once every pool.length days (the order changes only when
  // new challenges are added to the pool).
  const dayIndex = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
  const n = pool.length;
  const rand = mulberry32(0x5eed);
  const order = [...pool];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const replayOf = order[dayIndex % n];
  return { replayOf, challenge: challenges[replayOf] };
}

function normalizeChallenge(challenge, date) {
  if (!challenge) return null;
  if (Array.isArray(challenge.rounds)) return challenge;

  // Backward compatibility with legacy single-round data.
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const requestedDate =
    searchParams.get("date") || getTodayIsoDate(request.headers.get("x-timezone") || "");
  const challenges = await readChallenges();

  // Scheduled challenge for the day → use it. Otherwise replay a past one under
  // *today's* date, so progress, leaderboard and share text belong to today.
  let rawChallenge = challenges[requestedDate] || null;
  let resolvedDate = requestedDate;
  let replayOf = null;
  if (!rawChallenge) {
    const replay = pickReplayChallenge(challenges, requestedDate);
    if (replay) {
      rawChallenge = replay.challenge;
      replayOf = replay.replayOf;
    } else {
      const fallback = pickFallbackChallenge(challenges);
      rawChallenge = fallback?.challenge || null;
      resolvedDate = fallback?.date || requestedDate;
    }
  }
  const challenge = normalizeChallenge(rawChallenge, replayOf || resolvedDate);
  if (!challenge) {
    return Response.json(
      { error: "No challenge configured yet. Add one in /gamemaster." },
      { status: 404 }
    );
  }

  return Response.json({
    date: resolvedDate,
    ...(replayOf ? { replayOf } : {}),
    challenge
  });
}
