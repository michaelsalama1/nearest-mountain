import { loadMountains, meetsElevation } from "@/lib/mountains";

/** Roughly one dot per CELL_PX × CELL_PX screen pixels, biggest range wins. */
const CELL_PX = 6;
const MAX_POINTS = 4000;

/**
 * GET /api/mountainMap/inView?s=&w=&n=&e=&z=&minElevation=
 * Ranges inside the bounds, thinned to the zoom level, as compact rows:
 * [id, name, lat, lon, elevation_low, elevation_high, area, parents, countries]
 */
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const s = parseFloat(searchParams.get("s"));
        const n = parseFloat(searchParams.get("n"));
        let w = parseFloat(searchParams.get("w"));
        let e = parseFloat(searchParams.get("e"));
        const z = Math.max(0, Math.min(22, parseInt(searchParams.get("z"), 10) || 2));
        const minElevation = parseFloat(searchParams.get("minElevation")) || 0;

        if ([s, n, w, e].some((v) => isNaN(v))) {
            return Response.json({ error: "Invalid bounds" }, { status: 400 });
        }

        // Leaflet with worldCopyJump can report longitudes outside ±180.
        const wholeWorld = e - w >= 360;
        const norm = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
        w = norm(w);
        e = norm(e);
        const wraps = w > e;
        const inLon = (lon) => wholeWorld || (wraps ? lon >= w || lon <= e : lon >= w && lon <= e);

        const cellDeg = (360 / (256 * 2 ** z)) * CELL_PX;
        const thin = z < 9;

        const mountains = await loadMountains(); // largest first
        const taken = new Set();
        const rows = [];
        let truncated = false;

        for (const m of mountains) {
            if (!meetsElevation(m, minElevation)) continue;
            if (m.lat < s || m.lat > n || !inLon(m.lon)) continue;
            if (thin) {
                const latCell = cellDeg * Math.cos((m.lat * Math.PI) / 180) || cellDeg;
                const key = `${Math.floor(m.lon / cellDeg)},${Math.floor(m.lat / latCell)}`;
                if (taken.has(key)) continue;
                taken.add(key);
            }
            rows.push([m.id, m.name, m.lat, m.lon, m.elevation_low, m.elevation_high, m.area, m.parents, m.countries]);
            if (rows.length >= MAX_POINTS) {
                truncated = true;
                break;
            }
        }

        return Response.json({ mountains: rows, truncated });
    } catch (error) {
        console.error("Error processing request:", error);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
