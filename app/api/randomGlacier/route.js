import { loadGlaciers } from "@/lib/glaciers";

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const minArea = parseFloat(searchParams.get("minArea")) || 0;

        const glaciers = await loadGlaciers();
        const pool = minArea > 0 ? glaciers.filter((g) => g.area >= minArea) : glaciers;

        if (pool.length === 0) {
            return Response.json({ error: "No glaciers found above the specified area" }, { status: 404 });
        }

        const g = pool[Math.floor(Math.random() * pool.length)];
        return Response.json([{ ...g, distance: null }]);
    } catch (error) {
        console.error("Error processing request:", error);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
