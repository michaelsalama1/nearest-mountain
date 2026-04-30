import { promises as fs } from "fs";
import path from "path";
import { getGameCalendarDateYMD } from "./calendarDate";
import { getFirebaseAdminDb } from "./firebaseAdmin";

const CHALLENGES_PATH = path.join(process.cwd(), "data", "gameChallenges.json");
const FIRESTORE_CHALLENGES_COLLECTION = "gameChallenges";

async function ensureFile() {
  try {
    await fs.access(CHALLENGES_PATH);
  } catch {
    await fs.mkdir(path.dirname(CHALLENGES_PATH), { recursive: true });
    await fs.writeFile(CHALLENGES_PATH, JSON.stringify({}, null, 2), "utf8");
  }
}

export async function readChallenges() {
  const db = getFirebaseAdminDb();
  if (db) {
    const snapshot = await db.collection(FIRESTORE_CHALLENGES_COLLECTION).get();
    const challenges = {};
    snapshot.docs.forEach((docSnap) => {
      challenges[docSnap.id] = docSnap.data();
    });
    return challenges;
  }

  await ensureFile();
  const raw = await fs.readFile(CHALLENGES_PATH, "utf8");
  return JSON.parse(raw || "{}");
}

export async function writeChallenges(challenges) {
  const db = getFirebaseAdminDb();
  if (db) {
    const batch = db.batch();
    Object.entries(challenges).forEach(([date, challenge]) => {
      const ref = db.collection(FIRESTORE_CHALLENGES_COLLECTION).doc(date);
      batch.set(ref, challenge, { merge: true });
    });
    await batch.commit();
    return;
  }

  await ensureFile();
  await fs.writeFile(CHALLENGES_PATH, JSON.stringify(challenges, null, 2), "utf8");
}

/** @returns {string} YYYY-MM-DD in the game’s IANA zone (not UTC) */
export function getTodayIsoDate() {
  return getGameCalendarDateYMD();
}
