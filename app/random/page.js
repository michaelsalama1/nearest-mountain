/* "use client";

import { useState, useEffect } from "react";

export default function Random() {
    const [peakData, setPeakData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchRandomPeak() {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/scrapePeakbagger`);
                if (!response.ok) throw new Error("Failed to fetch data");
                const data = await response.json();
                setPeakData(data);
            } catch (err) {
                setError("Something went wrong. Please try again later.");
            } finally {
                setLoading(false);
            }
        }
        fetchRandomPeak();
    }, []);

    return (
        <div className="full-container">
            <div className="app-container">
                <h1>Random Mountain Generator ⛰️</h1>
                {loading && <p>Fetching a random mountain...</p>}
                {error && <p>{error}</p>}
                {peakData && (
                    <div className="mountain-info">
                        <h2>{peakData.name}</h2>
                        <p><strong>Elevation:</strong> {peakData.elevation}</p>
                        <p><strong>Prominence:</strong> {peakData.prominence}</p>
                        <p><strong>Isolation:</strong> {peakData.isolation}</p>
                        <p><strong>Location:</strong> {peakData.latitude}, {peakData.longitude}</p>
                        <p><strong>Region:</strong> {peakData.country}, {peakData.state}</p>
                        <p>
                            <a href={peakData.url} target="_blank" rel="noopener noreferrer">
                                View on Peakbagger 📌
                            </a>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
    */

"use client";

import React from 'react';

export default function RandomPage() {
    const generateRandomPeak = () => {
        // Generate a random peak ID (1 to 192424)
        const randomId = Math.floor(Math.random() * 192424) + 1;
        // Create the URL for the random peak
        const peakUrl = `https://www.peakbagger.com/peak.aspx?pid=${randomId}`;
        // Open the random peak URL in a new tab
        window.open(peakUrl, "_blank");
    };

    return (
        <div className="full-container">
            <div className="app-container">
                <h1>Random Mountain Generator ⛰️</h1>
                <button onClick={generateRandomPeak} className="random-peak-button">
                    Random Peak
                </button>
            </div>
        </div>
    );
}
