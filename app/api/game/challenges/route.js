import {
  getTodayIsoDate,
  readChallenges,
  writeChallenges
} from "../../../../lib/gameChallenges";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function normalizeChallenge(challenge, date) {
  if (!challenge) return null;

  if (Array.isArray(challenge.rounds)) {
    return challenge;
  }

  // Backward compatibility for legacy single-round challenge shape.
  return {
    id: challenge.id || date,
    rounds: [
      {
        title: challenge.title || "",
        description: challenge.description || "",
        imageUrl: challenge.imageUrl || "",
        latitude: Number(challenge.latitude),
        longitude: Number(challenge.longitude)
      }
    ]
  };
}

function validateRound(round, index) {
  const required = ["title", "latitude", "longitude"];
  for (const field of required) {
    if (round[field] === undefined || round[field] === null || round[field] === "") {
      return `Round ${index + 1}: missing ${field}`;
    }
  }

  const lat = Number(round.latitude);
  const lon = Number(round.longitude);
  if (Number.isNaN(lat) || lat < -90 || lat > 90) return `Round ${index + 1}: invalid latitude`;
  if (Number.isNaN(lon) || lon < -180 || lon > 180) return `Round ${index + 1}: invalid longitude`;
  return null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || getTodayIsoDate();
    const challenges = await readChallenges();
    const challenge = normalizeChallenge(challenges[date], date);
    return Response.json({ date, challenge });
  } catch (error) {
    return Response.json(
      { error: error?.message || "Failed to load challenge." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const secret = process.env.GAMEMASTER_KEY;
    if (!secret) {
      return Response.json(
        { error: "Set GAMEMASTER_KEY in environment first." },
        { status: 500 }
      );
    }

    const body = await request.json();
    if (body.key !== secret) return unauthorized();

    if (!Array.isArray(body.rounds) || body.rounds.length !== 5) {
      return Response.json({ error: "rounds must be an array of 5 items." }, { status: 400 });
    }

    for (let i = 0; i < body.rounds.length; i += 1) {
      const validationError = validateRound(body.rounds[i], i);
      if (validationError) {
        return Response.json({ error: validationError }, { status: 400 });
      }
    }

    const challenges = await readChallenges();
    challenges[body.date] = {
      id: body.date,
      rounds: body.rounds.map((round) => ({
        title: round.title,
        description: round.description || "",
        imageUrl: round.imageUrl,
        latitude: Number(round.latitude),
        longitude: Number(round.longitude)
      }))
    };

    await writeChallenges(challenges);
    return Response.json({ ok: true, challenge: challenges[body.date] });
  } catch (error) {
    const isReadOnlyFsError =
      error?.code === "EROFS" || error?.message?.toLowerCase().includes("read-only");

    return Response.json(
      {
        error: isReadOnlyFsError
          ? "Saving is not supported on deployed Vercel with file-based storage. Use persistent storage (database/blob/kv) for gamemaster edits."
          : error?.message || "Failed to save challenge."
      },
      { status: 500 }
    );
  }
}
