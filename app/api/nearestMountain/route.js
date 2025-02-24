import { promises as fs } from "fs";
import path from "path";

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const lat = parseFloat(searchParams.get("lat"));
        const lon = parseFloat(searchParams.get("lon"));
        const minElevation = parseFloat(searchParams.get("minElevation")) || 0;

        if (isNaN(lat) || isNaN(lon)) {
            return new Response(JSON.stringify({ error: "Invalid coordinates" }), { status: 400 });
        }

        // Load CSV data
        const filePath = path.join(process.cwd(), "public", "GMBA.csv");
        const csvData = await fs.readFile(filePath, "utf-8");

        // Convert CSV data to an array of objects
        const mountains = csvData.split("\n").slice(1).map((line) => {
            const columns = line.split(",");
            return {
                name: columns[3],
                lat: parseFloat(columns[39]),
                lon: parseFloat(columns[40]),
                elevation_low: parseInt(columns[36]),
                elevation_high: parseInt(columns[37]),
                range: columns[10],
                countries: columns[43],
                region: columns[8],
                map_unit: columns[31],
            };
        }).filter(m => !isNaN(m.lat) && !isNaN(m.lon) && m.map_unit !== "Aggregated");

        // Haversine function
        function haversine(lat1, lon1, lat2, lon2) {
            const R = 6371;
            const toRad = (deg) => (deg * Math.PI) / 180;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        // Find the 10 nearest mountains above minElevation
        let nearestMountains = [];

        mountains.forEach(mountain => {
            if ((mountain.elevation_high >= minElevation) || (mountain.elevation_low >= minElevation)) {
                const distance = haversine(lat, lon, mountain.lat, mountain.lon);

                // Maintain a sorted list of 10 closest mountains
                if (nearestMountains.length < 10) {
                    nearestMountains.push({ ...mountain, distance });
                    nearestMountains.sort((a, b) => a.distance - b.distance);
                } else if (distance < nearestMountains[9].distance) {
                    nearestMountains[9] = { ...mountain, distance };
                    nearestMountains.sort((a, b) => a.distance - b.distance);
                }
            }
        });

        if (nearestMountains.length === 0) {
            return new Response(JSON.stringify({ error: "No mountains found above the specified elevation" }), { status: 404 });
        }

        // Return the ordered list of 10 nearest mountains
        return new Response(JSON.stringify(nearestMountains), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Error processing request:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}
