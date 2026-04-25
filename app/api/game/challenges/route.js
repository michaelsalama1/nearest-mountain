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
        hint: challenge.hint || "",
        latitude: Number(challenge.latitude),
        longitude: Number(challenge.longitude)
      }
    ]
  };
}

/** Coerce partial rounds for save; WIP / empty fields are allowed. */
function coercedLatLon(round) {
  const lat0 = round.latitude;
  const lon0 = round.longitude;
  if (lat0 === "" || lat0 === null || lat0 === undefined) return { lat: 0, lon: 0 };
  if (lon0 === "" || lon0 === null || lon0 === undefined) return { lat: 0, lon: 0 };
  const lat = Number(lat0);
  const lon = Number(lon0);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return { lat: 0, lon: 0 };
  const clat = Math.min(90, Math.max(-90, lat));
  const clon = Math.min(180, Math.max(-180, lon));
  return { lat: clat, lon: clon };
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

    if (!Array.isArray(body.rounds) || body.rounds.length !== 1) {
      return Response.json({ error: "rounds must be an array of 1 item." }, { status: 400 });
    }

    const challenges = await readChallenges();
    challenges[body.date] = {
      id: body.date,
      rounds: body.rounds.map((round) => {
        const { lat, lon } = coercedLatLon(round);
        return {
          title: String(round?.title ?? ""),
          description: round?.description != null ? String(round.description) : "",
          imageUrl: round?.imageUrl != null ? String(round.imageUrl) : "",
          hint: round?.hint != null ? String(round.hint) : "",
          latitude: lat,
          longitude: lon
        };
      })
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
