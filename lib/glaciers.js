import { promises as fs } from "fs";
import path from "path";

/** GTN-G / RGI first-order glacier regions */
export const RGI_REGIONS = {
    1: "Alaska",
    2: "Western Canada & USA",
    3: "Arctic Canada North",
    4: "Arctic Canada South",
    5: "Greenland Periphery",
    6: "Iceland",
    7: "Svalbard & Jan Mayen",
    8: "Scandinavia",
    9: "Russian Arctic",
    10: "North Asia",
    11: "Central Europe",
    12: "Caucasus & Middle East",
    13: "Central Asia",
    14: "South Asia West",
    15: "South Asia East",
    16: "Low Latitudes",
    17: "Southern Andes",
    18: "New Zealand",
    19: "Antarctic & Subantarctic",
};

/**
 * GLIMS ids encode a point inside the glacier:
 * G<lon*1000, 0–360 east>E<lat*1000>N|S  e.g. G340953E63564N → 63.564, -19.047
 */
export function coordsFromGlimsId(id) {
    const m = /^G(\d{6})E(\d{5})([NS])$/.exec(id);
    if (!m) return null;
    let lon = parseInt(m[1], 10) / 1000;
    if (lon > 180) lon -= 360;
    let lat = parseInt(m[2], 10) / 1000;
    if (m[3] === "S") lat = -lat;
    return { lat, lon };
}

let cache = null;

/** Parsed once per server instance (the CSV is ~12 MB / ~390k glaciers). */
export async function loadGlaciers() {
    if (cache) return cache;
    const filePath = path.join(process.cwd(), "public", "glaciers.csv");
    const csv = await fs.readFile(filePath, "utf-8");
    const lines = csv.split(/\r?\n/);
    const out = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const [id, name, area, minElev, maxElev, region] = line.split(",");
        const c = coordsFromGlimsId(id);
        if (!c) continue;
        out.push({
            id,
            name,
            lat: c.lat,
            lon: c.lon,
            area: parseFloat(area) || 0,
            min_elev: minElev ? parseInt(minElev, 10) : null,
            max_elev: maxElev ? parseInt(maxElev, 10) : null,
            region: RGI_REGIONS[region] || "",
        });
    }
    cache = out;
    return out;
}

let byAreaCache = null;

/** Same glaciers, largest first, so map thinning keeps the biggest one per cell. */
export async function loadGlaciersByArea() {
    if (byAreaCache) return byAreaCache;
    const all = await loadGlaciers();
    byAreaCache = [...all].sort((a, b) => b.area - a.area);
    return byAreaCache;
}

export function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
