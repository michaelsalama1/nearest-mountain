import { loadGlaciers, haversine } from "@/lib/glaciers";

const COUNT = 10;

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const lat = parseFloat(searchParams.get("lat"));
        const lon = parseFloat(searchParams.get("lon"));
        const minArea = parseFloat(searchParams.get("minArea")) || 0;

        if (isNaN(lat) || isNaN(lon)) {
            return Response.json({ error: "Invalid coordinates" }, { status: 400 });
        }

        const glaciers = await loadGlaciers();

        // Keep a sorted list of the 10 closest glaciers at or above minArea
        const nearest = [];
        for (const g of glaciers) {
            if (g.area < minArea) continue;
            const distance = haversine(lat, lon, g.lat, g.lon);
            if (nearest.length < COUNT || distance < nearest[nearest.length - 1].distance) {
                nearest.push({ ...g, distance });
                nearest.sort((a, b) => a.distance - b.distance);
                if (nearest.length > COUNT) nearest.pop();
            }
        }

        if (nearest.length === 0) {
            return Response.json({ error: "No glaciers found above the specified area" }, { status: 404 });
        }

        return Response.json(nearest);
    } catch (error) {
        console.error("Error processing request:", error);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
