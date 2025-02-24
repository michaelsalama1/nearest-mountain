import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(req) {
    try {
        // Parse query parameters
        const { searchParams } = new URL(req.url);
        const minElevation = parseFloat(searchParams.get("minElevation")) || 0; // Default to 0 if not provided

        // Load the CSV data
        const filePath = path.join(process.cwd(), "public", "GMBA.csv");
        const csvData = await fs.readFile(filePath, "utf-8");

        // Convert CSV data to an array of objects
        const mountains = csvData.split("\n").slice(1).map((line) => {
            const columns = line.split(",");
            return {
                name: columns[3], // Mountain name
                lat: parseFloat(columns[39]), // Latitude
                lon: parseFloat(columns[40]), // Longitude
                elevation_low: parseInt(columns[36]), // Low elevation
                elevation_high: parseInt(columns[37]), // High elevation
                range: columns[10], // Mountain range
                countries: columns[43], // Countries
                region: columns[8], // Region
                map_unit: columns[31], // Type (Basic or Aggregated)
            };
        }).filter(m => !isNaN(m.lat) && !isNaN(m.lon) && m.map_unit !== "Aggregated"); // Filter out "Aggregated" units

        // Filter the mountains based on minimum elevation
        const filteredMountains = mountains.filter(mountain => {
            return mountain.elevation_high >= minElevation || mountain.elevation_low >= minElevation;
        });

        // If no mountains meet the elevation criteria, return an error
        if (filteredMountains.length === 0) {
            return NextResponse.json({ error: "No mountains found above the specified elevation" }, { status: 404 });
        }

        // Select a random mountain from the filtered list
        const randomMountain = filteredMountains[Math.floor(Math.random() * filteredMountains.length)];

        // Return random mountain data wrapped in an array
        return NextResponse.json([{
            name: randomMountain.name,
            lat: randomMountain.lat,
            lon: randomMountain.lon,
            range: randomMountain.range,
            countries: randomMountain.countries,
            elevation_low: randomMountain.elevation_low,
            elevation_high: randomMountain.elevation_high,
            elevation_range: randomMountain.elevation_high - randomMountain.elevation_low,
            region: randomMountain.region,
            map_unit: randomMountain.map_unit,
        }]);
    } catch (error) {
        console.error("Error fetching data from GMBA:", error);
        return NextResponse.json({ error: "Failed to fetch random mountain data" }, { status: 500 });
    }
}
