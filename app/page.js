"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // Import useRouter
import Head from "next/head";


export default function Home() {
    const router = useRouter();
    const [latitude, setLatitude] = useState(null);
    const [longitude, setLongitude] = useState(null);
    const [nearestMountains, setNearestMountains] = useState(null);
    const [elevation, setElevation] = useState(500);
    const [showCoordinateInput, setShowCoordinateInput] = useState(false);
    const [newLatitude, setNewLatitude] = useState(latitude || "");
    const [newLongitude, setNewLongitude] = useState(longitude || "");
    const [locationError, setLocationError] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [currentMountainIndex, setCurrentMountainIndex] = useState(0);


    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const lat = params.get("lat");
        const lon = params.get("lon");
        const elev = params.get("e");
        const index = params.get("i");
            
        if (lat && lon) {
            setLatitude(parseFloat(lat));
            setLongitude(parseFloat(lon));
        } else {
            if ("geolocation" in navigator) {
                const geoTimeout = setTimeout(() => {
                    setLocationError(true);
                    setShowCoordinateInput(true);
                }, 10000);
    
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        clearTimeout(geoTimeout);
                        setLatitude(position.coords.latitude);
                        setLongitude(position.coords.longitude);
                        setLocationError(false);
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


        }

    
        if (elev) setElevation(parseInt(elev));
        if (index) setCurrentMountainIndex(parseInt(index));
        console.log(currentMountainIndex);
    }, []); // Only run once when the component mounts
    
    
    useEffect(() => {
        if ((latitude || newLatitude) && (longitude || newLongitude)) {
            const lat = newLatitude || latitude;
            const lon = newLongitude || longitude;
            fetch(`/api/nearestMountain?lat=${lat}&lon=${lon}&minElevation=${elevation}`)
                .then((res) => res.json())
                .then((data) => {
                    setNearestMountains(data);
                    // If mountains are fetched successfully, update the URL with the index (currentMountainIndex)
                    console.log('a: '+currentMountainIndex);
                    updateURL(lat, lon, elevation, currentMountainIndex);
                })
                .catch((error) => console.error("Error fetching data:", error));
        }
    }, [latitude, longitude, elevation, newLatitude, newLongitude]); // This effect is triggered when coordinates or elevation changes
    
    

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
    

    useEffect(() => {
        if ((latitude || newLatitude) && (longitude || newLongitude)) {
            const lat = newLatitude || latitude;
            const lon = newLongitude || longitude;
            fetch(`/api/nearestMountain?lat=${lat}&lon=${lon}&minElevation=${elevation}`)
                .then((res) => res.json())
                .then((data) => {
                    setNearestMountains(data);
                   // setCurrentMountainIndex(0); // Reset slider position
                })
                .catch((error) => console.error("Error fetching data:", error));
        }
    }, [latitude, longitude, elevation, newLatitude, newLongitude]);

    

    const handleElevationChange = (event) => {
        const newElevation = event.target.value;
        setElevation(newElevation);
        updateURL(latitude, longitude, newElevation, currentMountainIndex);
    };

    const handleCoordinateSubmit = (event) => {
        event.preventDefault();
        setLatitude(parseFloat(event.target.latitude.value));
        setLongitude(parseFloat(event.target.longitude.value));
        setShowCoordinateInput(false);
        updateURL(event.target.latitude.value, event.target.longitude.value, elevation, currentMountainIndex);
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
                        <div className="coordinate-input-inline">
                            <input
                                type="number"
                                id="latitude"
                                value={newLatitude}
                                onChange={(e) => setNewLatitude(e.target.value)}
                                step="any"
                                placeholder="latitude"
                                required
                            />
                            <input
                                type="number"
                                id="longitude"
                                value={newLongitude}
                                onChange={(e) => setNewLongitude(e.target.value)}
                                step="any"
                                placeholder="longitude"
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
