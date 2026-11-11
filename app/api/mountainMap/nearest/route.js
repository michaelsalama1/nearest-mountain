import { loadMountains, meetsElevation } from "@/lib/mountains";
import { haversine } from "@/lib/glaciers";

const COUNT = 10;

/** GET /api/mountainMap/nearest?lat=&lon=&minElevation= → 10 nearest ranges */
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const lat = parseFloat(searchParams.get("lat"));
        const lon = parseFloat(searchParams.get("lon"));
        const minElevation = parseFloat(searchParams.get("minElevation")) || 0;

        if (isNaN(lat) || isNaN(lon)) {
            return Response.json({ error: "Invalid coordinates" }, { status: 400 });
        }

        const mountains = await loadMountains();
        const nearest = [];
        for (const m of mountains) {
            if (!meetsElevation(m, minElevation)) continue;
            const distance = haversine(lat, lon, m.lat, m.lon);
            if (nearest.length < COUNT || distance < nearest[nearest.length - 1].distance) {
                nearest.push({ ...m, distance });
                nearest.sort((a, b) => a.distance - b.distance);
                if (nearest.length > COUNT) nearest.pop();
            }
        }

        if (nearest.length === 0) {
            return Response.json({ error: "No mountains found above the specified elevation" }, { status: 404 });
        }
        return Response.json(nearest);
    } catch (error) {
        console.error("Error processing request:", error);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
