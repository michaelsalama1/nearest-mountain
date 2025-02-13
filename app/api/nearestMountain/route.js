import { promises as fs } from "fs";
import path from "path";

export async function GET(req) {
    try {
        // Parse query parameters
        const { searchParams } = new URL(req.url);
        const lat = parseFloat(searchParams.get("lat"));
        const lon = parseFloat(searchParams.get("lon"));
        const minElevation = parseFloat(searchParams.get("minElevation")) || 0; // Default to 0 if not provided

        if (isNaN(lat) || isNaN(lon)) {
            return new Response(JSON.stringify({ error: "Invalid coordinates" }), { status: 400 });
        }

        // Load the CSV data
        const filePath = path.join(process.cwd(), "public", "GMBA.csv");
        const csvData = await fs.readFile(filePath, "utf-8");

        // Convert CSV data to an array of objects
        const mountains = csvData.split("\n").slice(1).map((line) => {
            const columns = line.split(",");
            return {
                name: columns[3], // Assuming column 3 is the mountain name
                lat: parseFloat(columns[39]), // Assuming column 39 is latitude
                lon: parseFloat(columns[40]), // Assuming column 40 is longitude
                elevation_low: parseInt(columns[36]), // Assuming column 35 is low elevation
                elevation_high: parseInt(columns[37]), // Assuming column 36 is high elevation
                range: columns[10], // Assuming column 28 is the range
                countries: columns[43], // Assuming column 43 is the countries
                regions: columns[48], // Assuming column 48 is regions
                map_unit: columns[31], // Assuming column 32 is the type (Basic or Aggregated)
            };
        }).filter(m => !isNaN(m.lat) && !isNaN(m.lon) && m.map_unit !== "Aggregated"); // Filter rows where type is not "Aggregated"

        // Find the nearest mountain with elevation above the minimum threshold
        let nearest = null;
        let minDistance = Infinity;

        function haversine(lat1, lon1, lat2, lon2) {
            const R = 6371; // Radius of Earth in km
            const toRad = (deg) => (deg * Math.PI) / 180;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        mountains.forEach(mountain => {
            // Only consider mountains that are above the minElevation
            if ((mountain.elevation_high >= minElevation) || (mountain.elevation_low >= minElevation)) {
                const distance = haversine(lat, lon, mountain.lat, mountain.lon);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = mountain;
                }
            }
        });

        if (!nearest) {
            return new Response(JSON.stringify({ error: "No mountains found above the specified elevation" }), { status: 404 });
        }

        return new Response(JSON.stringify({
            name: nearest.name,
            latitude: nearest.lat,
            longitude: nearest.lon,
            distance_km: minDistance.toFixed(2),
            range: nearest.range,
            countries: nearest.countries,
            elevation_low: nearest.elevation_low,
            elevation_high: nearest.elevation_high,
            elevation_range: nearest.elevation_high - nearest.elevation_low,
            regions: nearest.regions,
            map_unit: nearest.map_unit,
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Error processing request:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}
