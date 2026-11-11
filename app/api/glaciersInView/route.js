import { loadGlaciersByArea } from "@/lib/glaciers";

/** Roughly one dot per CELL_PX × CELL_PX screen pixels, biggest glacier wins. */
const CELL_PX = 5;
const MAX_POINTS = 6000;

/**
 * GET /api/glaciersInView?s=&w=&n=&e=&z=
 * Returns glaciers inside the bounds, thinned to the zoom level, as compact rows:
 * [id, name, lat, lon, area, min_elev, max_elev, region]
 */
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const s = parseFloat(searchParams.get("s"));
        const n = parseFloat(searchParams.get("n"));
        let w = parseFloat(searchParams.get("w"));
        let e = parseFloat(searchParams.get("e"));
        const z = Math.max(0, Math.min(22, parseInt(searchParams.get("z"), 10) || 2));
        const minArea = parseFloat(searchParams.get("minArea")) || 0;

        if ([s, n, w, e].some((v) => isNaN(v))) {
            return Response.json({ error: "Invalid bounds" }, { status: 400 });
        }

        // Leaflet with worldCopyJump can report longitudes outside ±180.
        const wholeWorld = e - w >= 360;
        const norm = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
        w = norm(w);
        e = norm(e);
        const wraps = w > e; // view crosses the antimeridian
        const inLon = (lon) => wholeWorld || (wraps ? lon >= w || lon <= e : lon >= w && lon <= e);

        // degrees per screen pixel at this zoom (Web Mercator, 256px tiles)
        const cellDeg = (360 / (256 * 2 ** z)) * CELL_PX;
        // at deep zoom, show everything
        const thin = z < 12;

        const glaciers = await loadGlaciersByArea();
        const taken = new Set();
        const rows = [];
        let truncated = false;

        for (const g of glaciers) {
            if (g.area < minArea) continue;
            if (g.lat < s || g.lat > n || !inLon(g.lon)) continue;
            if (thin) {
                // shrink cell height toward the poles to roughly match Mercator stretch
                const latCell = cellDeg * Math.cos((g.lat * Math.PI) / 180) || cellDeg;
                const key = `${Math.floor(g.lon / cellDeg)},${Math.floor(g.lat / latCell)}`;
                if (taken.has(key)) continue;
                taken.add(key);
            }
            rows.push([g.id, g.name, g.lat, g.lon, g.area, g.min_elev, g.max_elev, g.region]);
            if (rows.length >= MAX_POINTS) {
                truncated = true;
                break;
            }
        }

        return Response.json({ glaciers: rows, truncated });
    } catch (error) {
        console.error("Error processing request:", error);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
