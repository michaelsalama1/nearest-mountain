import { promises as fs } from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

let cache = null;

/**
 * GMBA Mountain Inventory v2, "Basic" map units only, parsed with a real CSV
 * parser (some fields are quoted and contain commas). Largest ranges first,
 * so map thinning keeps the biggest range per cell.
 */
export async function loadMountains() {
    if (cache) return cache;
    const filePath = path.join(process.cwd(), "public", "GMBA.csv");
    const csv = await fs.readFile(filePath, "utf-8");
    const rows = parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: true });

    const out = [];
    for (const r of rows) {
        if (r.MapUnit !== "Basic") continue;
        const lat = parseFloat(r.Lat_Centr);
        const lon = parseFloat(r.Lon_Centr);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        // "Africa > East African Highlands > … > Danakil Alps" → parents only
        const parts = (r.Path || "").split(">").map((s) => s.trim()).filter(Boolean);
        out.push({
            id: r.GMBA_V2_ID,
            name: r.DBaseName || r.MapName,
            lat,
            lon,
            elevation_low: parseInt(r.Elev_Low, 10),
            elevation_high: parseInt(r.Elev_High, 10),
            area: parseFloat(r.Area) || 0,
            parents: parts.slice(0, -1).slice(-2).join(" › "), // two closest parents
            countries: r.Countries || "",
        });
    }
    out.sort((a, b) => b.area - a.area);
    cache = out;
    return out;
}

/** Same rule as /api/nearestMountain: either end of the range reaches minElevation. */
export function meetsElevation(m, minElevation) {
    return m.elevation_high >= minElevation || m.elevation_low >= minElevation;
}
