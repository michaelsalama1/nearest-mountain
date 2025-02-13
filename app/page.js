"use client";

import { useState, useEffect } from "react";

export default function Home() {
    const [latitude, setLatitude] = useState(null);
    const [longitude, setLongitude] = useState(null);
    const [nearestMountain, setNearestMountain] = useState(null);
    const [elevation, setElevation] = useState(150); // Default elevation set to 500ft (~150m)

    useEffect(() => {
        if ("geolocation" in navigator && latitude === null && longitude === null) {
            navigator.geolocation.getCurrentPosition((position) => {
                setLatitude(position.coords.latitude);
                setLongitude(position.coords.longitude);
            });
        }
    }, [latitude, longitude]); // Only trigger if latitude or longitude change

    useEffect(() => {
        if (latitude && longitude) {
            fetch(`/api/nearestMountain?lat=${latitude}&lon=${longitude}&minElevation=${elevation}`)
                .then((res) => res.json())
                .then((data) => setNearestMountain(data))
                .catch((error) => console.error("Error fetching data:", error));
        }
    }, [latitude, longitude, elevation]); // Trigger when latitude, longitude, or elevation changes

    const handleElevationChange = (event) => {
        setElevation(event.target.value);
    };

    const handleLatitudeChange = (event) => {
        setLatitude(event.target.value);
    };

    const handleLongitudeChange = (event) => {
        setLongitude(event.target.value);
    };

    return (
        <div className="full-container">
            <div className="app-container">
                <h1>Find the Nearest Mountain &#127956;</h1>
                {latitude && longitude ? (
                    <div className="location">
                        <p>
                            Your Location: 
                            <input
                                type="number"
                                value={latitude || ''}
                                onChange={handleLatitudeChange}
                                step="any"
                                placeholder="Enter latitude"
                                className="coord"
                            /> 
                            , 
                            <input
                                type="number"
                                value={longitude || ''}
                                onChange={handleLongitudeChange}
                                step="any"
                                placeholder="Enter longitude"
                                className="coord"
                            />
                        </p>
                    </div>
                ) : (
                    <p>Fetching location...</p>
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
                        <p>Unit: {nearestMountain.map_unit}</p>
                        <p><strong>Elevation: </strong>{nearestMountain.elevation_high}m</p>
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
