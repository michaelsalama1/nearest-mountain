"use client";

import { useEffect, useState } from "react";

/** Browsers can hang on the default (often infinite) lock unless timeout / maxAge are set. */
const GEO_OPTIONS = {
    enableHighAccuracy: false,
    maximumAge: 5 * 60 * 1000,
    timeout: 12_000,
};

/** e.g. "46.034291, -110.329524" → { lat, lon } or null */
export function parseLatLonPair(text) {
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

export function formatDistance(km) {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toLocaleString(undefined, { maximumFractionDigits: km < 100 ? 1 : 0 })} km`;
}

/**
 * Initial location: ?lat&lon in the URL, else browser geolocation, else none.
 * Also hands back the initial URL params so pages can read their own filters.
 */
export function useExplorerLocation() {
    const [user, setUser] = useState(null);
    const [ready, setReady] = useState(false);
    const [locationFailed, setLocationFailed] = useState(false);
    const [params, setParams] = useState(null);

    useEffect(() => {
        const p = new URLSearchParams(window.location.search);
        setParams(p);
        const lat = parseFloat(p.get("lat"));
        const lon = parseFloat(p.get("lon"));

        if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
            setUser({ lat, lon });
            setReady(true);
            return;
        }

        const giveUp = () => {
            setLocationFailed(true);
            setReady(true);
        };

        if (!("geolocation" in navigator)) return giveUp();

        const timeoutId = setTimeout(giveUp, GEO_OPTIONS.timeout + 3_000);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                clearTimeout(timeoutId);
                setUser({
                    lat: Number(pos.coords.latitude.toFixed(4)),
                    lon: Number(pos.coords.longitude.toFixed(4)),
                });
                setReady(true);
            },
            () => {
                clearTimeout(timeoutId);
                giveUp();
            },
            GEO_OPTIONS
        );
        return () => clearTimeout(timeoutId);
    }, []);

    return { user, setUser, ready, locationFailed, params };
}

/** "Your location: … · change" with an inline lat,lon form. */
export function LocationLine({ user, locationFailed, onSubmit }) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState("");
    const [error, setError] = useState("");

    const open = editing || (!user && locationFailed);

    const submit = (event) => {
        event.preventDefault();
        const parsed = parseLatLonPair(text);
        if (!parsed) {
            setError("Use two numbers: latitude, longitude (e.g. 46.034291, -110.329524).");
            return;
        }
        setError("");
        setEditing(false);
        onSubmit({ lat: Number(parsed.lat.toFixed(4)), lon: Number(parsed.lon.toFixed(4)) });
    };

    return (
        <div className="explorer-location">
            {user ? (
                <p className="your-loc">
                    Your location: {user.lat.toFixed(4)}, {user.lon.toFixed(4)}
                    {!open ? (
                        <button
                            type="button"
                            className="explorer-link-button"
                            onClick={() => {
                                setText(`${user.lat}, ${user.lon}`);
                                setError("");
                                setEditing(true);
                            }}
                        >
                            change
                        </button>
                    ) : null}
                </p>
            ) : (
                <p className="your-loc">
                    {locationFailed
                        ? "Location unavailable. Click the map or enter coordinates."
                        : "Finding your location…"}
                </p>
            )}
            {open ? (
                <form onSubmit={submit} className="explorer-coord-form">
                    <input
                        type="text"
                        aria-label="Coordinates (latitude, longitude)"
                        value={text}
                        onChange={(e) => {
                            setText(e.target.value);
                            setError("");
                        }}
                        autoComplete="off"
                        inputMode="decimal"
                        placeholder="46.034291, -110.329524"
                    />
                    <button type="submit">Go &#x1f4cd;</button>
                    {editing ? (
                        <button type="button" className="explorer-link-button" onClick={() => setEditing(false)}>
                            cancel
                        </button>
                    ) : null}
                    {error ? (
                        <p className="error-code" role="alert">
                            {error}
                        </p>
                    ) : null}
                </form>
            ) : null}
        </div>
    );
}

export function ViewToggle({ view, onChange }) {
    return (
        <div className="explorer-view-toggle" role="tablist" aria-label="View">
            {[
                ["map", "Map"],
                ["list", "List"],
            ].map(([key, label]) => (
                <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={view === key}
                    className={view === key ? "active" : ""}
                    onClick={() => onChange(key)}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

export function AboutOverlay({ onClose, children }) {
    return (
        <div className="about-overlay">
            <button className="close-about" onClick={onClose}>
                ✖ Close
            </button>
            <div className="about-container">{children}</div>
        </div>
    );
}
