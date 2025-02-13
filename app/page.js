"use client";

import { useState, useEffect } from "react";

export default function Home() {
    const [latitude, setLatitude] = useState(null);
    const [longitude, setLongitude] = useState(null);
    const [nearestMountain, setNearestMountain] = useState(null);
    const [elevation, setElevation] = useState(500);
    const [showCoordinateInput, setShowCoordinateInput] = useState(false);
    const [newLatitude, setNewLatitude] = useState("");
    const [newLongitude, setNewLongitude] = useState("");
    const [locationError, setLocationError] = useState(false);
    const [showAbout, setShowAbout] = useState(false); // State to toggle About section

    const generateRandomPeak = () => {
        const randomId = Math.floor(Math.random() * 192424) + 1;
        const peakUrl = `https://www.peakbagger.com/peak.aspx?pid=${randomId}`;
        window.open(peakUrl, "_blank");
    };

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLatitude(position.coords.latitude);
                    setLongitude(position.coords.longitude);
                    setLocationError(false);
                },
                () => {
                    setLocationError(true);
                    setShowCoordinateInput(true);
                }
            );
        } else {
            setLocationError(true);
            setShowCoordinateInput(true);
        }
    }, []);

    useEffect(() => {
        if ((latitude || newLatitude) && (longitude || newLongitude)) {
            const lat = newLatitude || latitude;
            const lon = newLongitude || longitude;
            fetch(`/api/nearestMountain?lat=${lat}&lon=${lon}&minElevation=${elevation}`)
                .then((res) => res.json())
                .then((data) => setNearestMountain(data))
                .catch((error) => console.error("Error fetching data:", error));
        }
    }, [latitude, longitude, elevation, newLatitude, newLongitude]);

    const handleElevationChange = (event) => {
        setElevation(event.target.value);
    };

    const handleCoordinateSubmit = (event) => {
        event.preventDefault();
        setLatitude(parseFloat(newLatitude));
        setLongitude(parseFloat(newLongitude));
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
                    <p className="error-code">{locationError ? "Location disabled" : "Fetching location..."}</p>
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
                        <p><strong>Nearest Mountain Range:<br />{nearestMountain.name}</strong></p>
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
                                View on Google Maps
                            </a>
                        </p>
                        <button onClick={generateRandomPeak} className="random-peak-button">
                            &#9968; Random Peak &#9968;
                        </button>
                    </div>
                ) : (
                    <p>Loading nearest mountain...</p>
                )}
            </div>

            <div className="about">
                <button onClick={() => setShowAbout(true)}>
                    about
                </button>
            </div>

            {showAbout && (
                <div className="about-overlay">
                    <button className="close-about" onClick={() => setShowAbout(false)}>
                            ✖ Close
                        </button>
                    <div className="about-container">
                        <p>
                            Welcome to <code>nearestmountain.com</code>. This is a simple calculator that determines the closest mountain range to your current location. It uses the GMBA Mountain Inventory database, cited below, and therefore output coordinates currently link to the geographic center of the nearest range, not mountain peaks themselves. 
                        </p>
                        <p>
                        The random peak generator just links to a random listing on <code>peakbagger.com</code>.
                        </p>
                        <p>
                            Background: Nevado Sajama, Bolivia.
                        </p>
                        <p>
                            If you would like to fork this project, you can reach me at <code>me@michaelsalama.com</code>
                        </p>
                        <p className="citation">
                            Dataset: Snethlage, M.A., Geschke, J., Spehn, E.M., Ranipeta, A., Yoccoz, N.G., Körner, Ch., Jetz, W., Fischer, M. & Urbach, D. GMBA Mountain Inventory v2. GMBA-EarthEnv. https://doi.org/10.48601/earthenv-t9k2-1407 (2022).
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
