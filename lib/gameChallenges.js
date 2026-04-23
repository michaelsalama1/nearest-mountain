import { promises as fs } from "fs";
import path from "path";
import { getGameCalendarDateYMD } from "./calendarDate";

const CHALLENGES_PATH = path.join(process.cwd(), "data", "gameChallenges.json");

async function ensureFile() {
  try {
    await fs.access(CHALLENGES_PATH);
  } catch {
    await fs.mkdir(path.dirname(CHALLENGES_PATH), { recursive: true });
    await fs.writeFile(CHALLENGES_PATH, JSON.stringify({}, null, 2), "utf8");
  }
}

export async function readChallenges() {
  await ensureFile();
  const raw = await fs.readFile(CHALLENGES_PATH, "utf8");
  return JSON.parse(raw || "{}");
}

export async function writeChallenges(challenges) {
  await ensureFile();
  await fs.writeFile(CHALLENGES_PATH, JSON.stringify(challenges, null, 2), "utf8");
}

/** @returns {string} YYYY-MM-DD in the game’s IANA zone (not UTC) */
export function getTodayIsoDate() {
  return getGameCalendarDateYMD();
}
