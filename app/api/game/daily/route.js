import { getTodayIsoDate, readChallenges } from "../../../../lib/gameChallenges";

function pickFallbackChallenge(challenges) {
  const dates = Object.keys(challenges).sort();
  if (!dates.length) return null;
  const latestDate = dates[dates.length - 1];
  return { date: latestDate, challenge: challenges[latestDate] };
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
  const requestedDate = searchParams.get("date") || getTodayIsoDate();
  const challenges = await readChallenges();

  const fallback = pickFallbackChallenge(challenges);
  const rawChallenge = challenges[requestedDate] || fallback?.challenge || null;
  const resolvedDate = challenges[requestedDate] ? requestedDate : fallback?.date || requestedDate;
  const challenge = normalizeChallenge(rawChallenge, resolvedDate);
  if (!challenge) {
    return Response.json(
      { error: "No challenge configured yet. Add one in /gamemaster." },
      { status: 404 }
    );
  }

  return Response.json({
    date: resolvedDate,
    challenge
  });
}
