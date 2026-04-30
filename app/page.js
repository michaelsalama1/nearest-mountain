"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // Import useRouter
import Head from "next/head";
import Link from "next/link";

/** Browsers can hang on the default (often infinite) lock unless timeout / maxAge are set. */
const GEO_OPTIONS = {
    enableHighAccuracy: false,
    maximumAge: 5 * 60 * 1000,
    timeout: 12_000,
};

/** e.g. "46.034291, -110.329524" → { lat, lon } or null */
function parseLatLonPair(text) {
    if (typeof text !== "string") return null;
    const t = text.trim();
    if (!t) return null;
    const i = t.indexOf(",");
    if (i === -1) return null;
    if (t.slice(i + 1).includes(",")) return null;
    const lat = parseFloat(t.slice(0, i).trim());
    const lon = parseFloat(t.slice(i + 1).trim());
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat, lon };
}

export default function Home() {
    const router = useRouter();
    const [latitude, setLatitude] = useState(null);
    const [longitude, setLongitude] = useState(null);
    const [nearestMountains, setNearestMountains] = useState(null);
    const [elevation, setElevation] = useState(500);
    const [showCoordinateInput, setShowCoordinateInput] = useState(false);
    const [manualCoords, setManualCoords] = useState("");
    const [coordError, setCoordError] = useState("");
    const [locationError, setLocationError] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [currentMountainIndex, setCurrentMountainIndex] = useState(0);


    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const lat = params.get("lat");
        const lon = params.get("lon");
        const elev = params.get("e");
        const index = params.get("i");

        let geoTimeoutId;

        if (lat && lon) {
            setLatitude(parseFloat(lat));
            setLongitude(parseFloat(lon));
        } else if ("geolocation" in navigator) {
            // Backup if the browser is slow to invoke callbacks (e.g. heavy timer throttling in a background tab).
            geoTimeoutId = setTimeout(() => {
                setLocationError(true);
                setShowCoordinateInput(true);
            }, GEO_OPTIONS.timeout + 3_000);

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    clearTimeout(geoTimeoutId);
                    setLatitude(position.coords.latitude);
                    setLongitude(position.coords.longitude);
                    setLocationError(false);
                },
                () => {
                    clearTimeout(geoTimeoutId);
                    setLocationError(true);
                    setShowCoordinateInput(true);
                },
                GEO_OPTIONS
            );
        } else {
            setLocationError(true);
            setShowCoordinateInput(true);
        }

        if (elev) setElevation(parseInt(elev, 10));
        if (index) setCurrentMountainIndex(parseInt(index, 10));
        console.log(currentMountainIndex);

        return () => {
            if (geoTimeoutId) clearTimeout(geoTimeoutId);
        };
    }, []); // Only run once when the component mounts
    
    
    useEffect(() => {
        if (latitude == null || longitude == null) return;
        const lat = Number(latitude);
        const lon = Number(longitude);
        fetch(`/api/nearestMountain?lat=${lat}&lon=${lon}&minElevation=${elevation}`)
            .then((res) => res.json())
            .then((data) => {
                setNearestMountains(data);
                // If mountains are fetched successfully, update the URL with the index (currentMountainIndex)
                console.log("a: " + currentMountainIndex);
                updateURL(lat, lon, elevation, currentMountainIndex);
            })
            .catch((error) => console.error("Error fetching data:", error));
    }, [latitude, longitude, elevation]);
    
    

    const updateURL = (lat, lon, elev, index) => {
        router.push(`/?lat=${lat}&lon=${lon}&e=${elev}&i=${index}`, undefined, { shallow: true });
    };

    const generateRandomRange = () => {
        fetch(`/api/randomRange?lat=${latitude}&lon=${longitude}&minElevation=${elevation}`)
            .then((res) => res.json())
            .then((data) => {
                setNearestMountains(data);
                setCurrentMountainIndex(0); // Reset index to avoid out-of-bounds errors
                updateURL(data[0].lat, data[0].lon, elevation, 0); // Update the URL accordingly
            })
            .catch((error) => console.error("Error fetching data:", error));
    };

  /*  useEffect(() => {
        if ("geolocation" in navigator) {
            const geoTimeout = setTimeout(() => {
                setLocationError(true);
                setShowCoordinateInput(true);
            }, 10000);
    
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    clearTimeout(geoTimeout);
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    setLatitude(lat);
                    setLongitude(lon);
                    setLocationError(false);
                    updateURL(lat, lon, elevation, currentMountainIndex);
                },
                () => {
                    clearTimeout(geoTimeout);
                    setLocationError(true);
                    setShowCoordinateInput(true);
                }
            );
        } else {
            setLocationError(true);
            setShowCoordinateInput(true);
        }
    }, []); */
    

    const handleElevationChange = (event) => {
        const newElevation = event.target.value;
        setElevation(newElevation);
        updateURL(latitude, longitude, newElevation, currentMountainIndex);
    };

    const handleCoordinateSubmit = (event) => {
        event.preventDefault();
        const parsed = parseLatLonPair(manualCoords);
        if (!parsed) {
            setCoordError("Use two numbers: latitude, longitude (e.g. 46.034291, -110.329524).");
            return;
        }
        setCoordError("");
        setLatitude(parsed.lat);
        setLongitude(parsed.lon);
        setLocationError(false);
        setShowCoordinateInput(false);
        updateURL(parsed.lat, parsed.lon, elevation, currentMountainIndex);
    };

    const handleNext = () => {
        const newIndex = (currentMountainIndex + 1) % nearestMountains.length;
        setCurrentMountainIndex(newIndex);
        updateURL(latitude, longitude, elevation, newIndex);
    };

    const handlePrevious = () => {
        const newIndex = currentMountainIndex > 0 ? currentMountainIndex - 1 : nearestMountains.length - 1;
        setCurrentMountainIndex(newIndex);
        updateURL(latitude, longitude, elevation, newIndex);
    };

    const haversine = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const toRad = (deg) => (deg * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    return (
        <div className="full-container">
            <div className="summit-daily-cta-wrap">
                <Link href="/play" className="summit-daily-cta__link">
                    <span className="summit-daily-cta__label">play the Daily Challenge</span>
                    <span className="summit-daily-cta__arrow" aria-hidden="true">
                        &rarr;
                    </span>
                </Link>
            </div>

            <div className="app-container">
                <h1>Nearest Mountain &#127956;</h1>
                {latitude && longitude ? (
                    <div className="location">
                        <p className="your-loc">
                            Your Location: {latitude.toFixed(4)}, {longitude.toFixed(4)}
                        </p>
                        {!showCoordinateInput && (
                            <button
                                type="button"
                                onClick={() => {
                                    setManualCoords(`${latitude}, ${longitude}`);
                                    setCoordError("");
                                    setShowCoordinateInput(true);
                                }}
                                className="change-coordinates-button"
                            >
                                Change Coordinates
                            </button>
                        )}
                    </div>
                ) : (
                    <div>
                        <p className="error-code">{locationError ? "Location disabled. Enter coordinates manually." : "Fetching location..."}</p>
                        <button onClick={generateRandomRange} className="random-peak-button">
                            &#9968; Random &#9968;
                        </button>
                        <span><br /><br /></span>
                    </div>
                )}

                {showCoordinateInput && (
                    <form onSubmit={handleCoordinateSubmit} className="coordinate-input-form">
                        <label className="coordinate-pair-label" htmlFor="coordinates">
                            Coordinates
                        </label>
                        <div className="coordinate-input-inline">
                            <input
                                type="text"
                                id="coordinates"
                                name="coordinates"
                                value={manualCoords}
                                onChange={(e) => {
                                    setManualCoords(e.target.value);
                                    setCoordError("");
                                }}
                                autoComplete="off"
                                inputMode="decimal"
                                placeholder="46.034291, -110.329524"
                                className="coordinate-pair-input"
                            />
                        </div>
                        {coordError ? (
                            <p id="coord-parse-error" className="error-code" role="alert">
                                {coordError}
                            </p>
                        ) : null}
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

                {nearestMountains ? (
                    <div className="mountain-info">
                        <p><strong>Nearest Mountain Range:<br /><span className="targetRange">{nearestMountains[currentMountainIndex].name}</span></strong><br />{nearestMountains[currentMountainIndex].region}</p>
                        <p>Location: {nearestMountains[currentMountainIndex].lat}, {nearestMountains[currentMountainIndex].lon}</p>
                        <p>Distance: {haversine(latitude, longitude, nearestMountains[currentMountainIndex].lat, nearestMountains[currentMountainIndex].lon).toFixed(2)} kilometers away</p>
                        <p><strong>Max Elevation: </strong>{nearestMountains[currentMountainIndex].elevation_high}m</p>
                        
                        {nearestMountains.length > 1 && 
                        <div className="slider-controls">
                            <button onClick={handlePrevious} className="prev-button">❮</button>
                            <span className="slider-index">  {currentMountainIndex + 1} / {nearestMountains.length}  </span>
                            <button onClick={handleNext} className="next-button">❯</button>
                        </div>
                        }
                        
                        <p>
                            <a
                                href={`https://www.google.com/maps?q=${nearestMountains[currentMountainIndex].lat},${nearestMountains[currentMountainIndex].lon}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="google-map-link"
                            >
                                View on Google Maps
                            </a>
                        </p>

                        

                        <button onClick={generateRandomRange} className="random-peak-button">
                            &#9968; Random Mountain Range &#9968;
                        </button>
                    </div>
                ) : (
                    <p>Loading nearest mountain...</p>
                )}
            </div>

            <div className="summit-ext-cta-wrap">
                <a
                    href="https://github.com/michaelsalama1/nearest-mountain/tree/main/ext"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="summit-ext-link"
                >
                    now available as a browser extension for use in google maps
                </a>
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
                Welcome to <code>nearestmountain.com</code>, a tool for people who are allergic to sea level. It is a simple calculator that determines the closest mountain range to your current location. It uses the GMBA Mountain Inventory database, cited below, and as a result it outputs the geographic center of the nearest ranges, not individual mountain peaks.
            </p>
            <p>
                The random range generator outputs a random mountain range from the GMBA database based on your selected elevation criteria.
            </p>
            <p>
                Background images: Nevado Sajama, Oruro, Bolivia & Garnet Peak, California, USA.
            </p>
            <p>
                I can be reached at <code>me@michaelsalama.com</code>
            </p>
            <p className="citation">
                Snethlage, M.A., Geschke, J., Spehn, E.M., Ranipeta, A., Yoccoz, N.G., Körner, Ch., Jetz, W., Fischer, M. & Urbach, D. GMBA Mountain Inventory v2. GMBA-EarthEnv. https://doi.org/10.48601/earthenv-t9k2-1407 (2022).
            </p>
        </div>
    </div>
)}

        </div>
    );
}
