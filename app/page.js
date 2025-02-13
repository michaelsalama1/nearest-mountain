"use client";

import { useState, useEffect } from "react";

export default function Home() {
    const [latitude, setLatitude] = useState(null);
    const [longitude, setLongitude] = useState(null);
    const [nearestMountain, setNearestMountain] = useState(null);
    const [elevation, setElevation] = useState(150); // Default elevation set to 500ft (~150m)
    const [showCoordinateInput, setShowCoordinateInput] = useState(false); // State to toggle coordinate input visibility
    const [newLatitude, setNewLatitude] = useState(""); // State for new latitude input
    const [newLongitude, setNewLongitude] = useState(""); // State for new longitude input
    const [locationError, setLocationError] = useState(false); // State to track location errors

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLatitude(position.coords.latitude);
                    setLongitude(position.coords.longitude);
                    setLocationError(false); // Clear error if location is successfully retrieved
                },
                () => {
                    // Geolocation unavailable, show manual input
                    setLocationError(true);
                    setShowCoordinateInput(true);
                }
            );
        } else {
            // Geolocation is not supported by the browser, show manual input
            setLocationError(true);
            setShowCoordinateInput(true);
        }
    }, []); // Trigger once on mount

    useEffect(() => {
        if ((latitude || newLatitude) && (longitude || newLongitude)) {
            const lat = newLatitude || latitude;
            const lon = newLongitude || longitude;
            fetch(`/api/nearestMountain?lat=${lat}&lon=${lon}&minElevation=${elevation}`)
                .then((res) => res.json())
                .then((data) => setNearestMountain(data))
                .catch((error) => console.error("Error fetching data:", error));
        }
    }, [latitude, longitude, elevation, newLatitude, newLongitude]); // Trigger when latitude, longitude, or elevation changes

    const handleElevationChange = (event) => {
        setElevation(event.target.value);
    };

    const handleCoordinateSubmit = (event) => {
        event.preventDefault();
        // Set the coordinates from input
        setLatitude(parseFloat(newLatitude));
        setLongitude(parseFloat(newLongitude));
        // Hide input fields after submission
        setShowCoordinateInput(false);
    };

    return (
        <div className="full-container">
            <div className="app-container">
                <h1>Find the Nearest Mountain &#127956;</h1>
                {latitude && longitude ? (
                    <div className="location">
                        <p className="your-loc">
                            Your Location: {latitude.toFixed(4)}, {longitude.toFixed(4)}
                        </p>
                        {!showCoordinateInput && (
                            <button
                                onClick={() => setShowCoordinateInput(true)}
                                className="change-coordinates-button"
                            >
                                Change Coordinates
                            </button>
                        )}
                    </div>
                ) : (
                    <p className="error-code">{locationError ? "location disabled" : "Fetching location..."}</p>
                )}

                {showCoordinateInput && (
                    <form onSubmit={handleCoordinateSubmit} className="coordinate-input-form">
                        <div className="coordinate-input-inline">
                            <input
                                type="number"
                                id="latitude"
                                value={newLatitude}
                                onChange={(e) => setNewLatitude(e.target.value)}
                                step="any"
                                placeholder="Latitude"
                                required
                            />
                            <input
                                type="number"
                                id="longitude"
                                value={newLongitude}
                                onChange={(e) => setNewLongitude(e.target.value)}
                                step="any"
                                placeholder="Longitude"
                                required
                            />
                        </div>

                        <button type="submit" className="submit-coordinates-button">
                            Go &#x1f4cd;
                        </button>
                    </form>
                )}

                <div className="elevation-control">
                    <label htmlFor="elevation">Desired Elevation (meters): </label>
                    <input
                        type="number"
                        id="elevation"
                        value={elevation}
                        onChange={handleElevationChange}
                        min="0"
                        placeholder="Enter elevation in meters"
                        className="elevation-input"
                    />
                </div>

                {nearestMountain ? (
                    <div className="mountain-info">
                        <p><strong>Nearest Mountain Range:<br></br>{nearestMountain.name}</strong></p>
                        <p>Location: {nearestMountain.latitude}, {nearestMountain.longitude}</p>
                        <p>Distance: {nearestMountain.distance_km} kilometers away</p>
                        <p><strong>Max Elevation: </strong>{nearestMountain.elevation_high}m</p>
                        <p>
                            <a
                                href={`https://www.google.com/maps?q=${nearestMountain.latitude},${nearestMountain.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="google-map-link"
                            >
                            &#9968; View on Google Maps &#9968;
                            </a>
                        </p>
                    </div>
                ) : (
                    <p>Loading nearest mountain...</p>
                )}
            </div>

            <div className="citation">
                <p>
                    Dataset:<br />Snethlage, M.A., Geschke, J., Spehn, E.M., Ranipeta, A., Yoccoz, N.G., Körner, Ch., Jetz, W., Fischer, M. & Urbach, D. GMBA Mountain Inventory v2. GMBA-EarthEnv. https://doi.org/10.48601/earthenv-t9k2-1407 (2022).
                </p>
            </div>
        </div>
    );
}
