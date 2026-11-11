import { loadMountains, meetsElevation } from "@/lib/mountains";

/** GET /api/mountainMap/random?minElevation= → one random range (same shape as /nearest) */
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const minElevation = parseFloat(searchParams.get("minElevation")) || 0;
        const pool = (await loadMountains()).filter((m) => meetsElevation(m, minElevation));
        if (pool.length === 0) {
            return Response.json({ error: "No mountains found above the specified elevation" }, { status: 404 });
        }
        return Response.json(pool[Math.floor(Math.random() * pool.length)]);
    } catch (error) {
        console.error("Error processing request:", error);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
