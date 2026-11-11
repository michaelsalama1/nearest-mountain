"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    AboutOverlay,
    LocationLine,
    ViewToggle,
    formatDistance,
    useExplorerLocation,
} from "./_components/explorer";

const MountainMap = dynamic(() => import("./_components/MountainMap"), {
    ssr: false,
    loading: () => <div className="leaflet-map glacier-map glacier-map--loading">Loading map…</div>,
});

export default function Home() {
    const router = useRouter();
    const { user, setUser, ready, locationFailed, params } = useExplorerLocation();
    const [view, setView] = useState("map");
    const [minElevation, setMinElevation] = useState(500);
    const [nearestList, setNearestList] = useState(null);
    const [status, setStatus] = useState("");
    const [callout, setCallout] = useState(null); // { mountain, key }
    const [focus, setFocus] = useState(null); // { lat, lon, key }
    const [showAbout, setShowAbout] = useState(false);
    const counter = useRef(0);
    const nearest = nearestList?.[0] ?? null;

    const openCallout = (mountain) => {
        counter.current += 1;
        setCallout(mountain ? { mountain, key: counter.current } : null);
    };

    const showOnMap = (mountain) => {
        counter.current += 1;
        setCallout({ mountain, key: counter.current });
        setFocus({ lat: mountain.lat, lon: mountain.lon, key: counter.current });
        setView("map");
    };

    // Filters / view from the URL (old list links used ?e= too).
    useEffect(() => {
        if (!params) return;
        const e = parseFloat(params.get("e"));
        if (Number.isFinite(e)) setMinElevation(e);
        if (params.get("view") === "list") setView("list");
    }, [params]);

    // Location or filter changed → nearest ranges.
    useEffect(() => {
        if (!user) return;
        setStatus("Finding the nearest mountain range…");
        let cancelled = false;
        fetch(`/api/mountainMap/nearest?lat=${user.lat}&lon=${user.lon}&minElevation=${minElevation}`)
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                if (!Array.isArray(data) || data.length === 0) {
                    setNearestList(null);
                    setCallout(null);
                    setStatus(data?.error || "No mountain range found.");
                    return;
                }
                setNearestList(data);
                openCallout(data[0]);
                setStatus("");
            })
            .catch(() => !cancelled && setStatus("Could not load mountain ranges."));
        return () => {
            cancelled = true;
        };
    }, [user, minElevation]);

    // Keep the URL shareable.
    useEffect(() => {
        if (!user) return;
        const q = new URLSearchParams({ lat: user.lat, lon: user.lon, e: minElevation });
        if (view === "list") q.set("view", "list");
        router.replace(`/?${q}`, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, minElevation, view]);

    const changeView = (v) => {
        if (v === "list") setFocus(null);
        setView(v);
    };

    const randomRange = () => {
        fetch(`/api/mountainMap/random?minElevation=${minElevation}`)
            .then((res) => res.json())
            .then((m) => {
                if (m?.error) return setStatus(m.error);
                showOnMap(m);
            })
            .catch(() => setStatus("Could not load a random range."));
    };

    const handleElevationChange = (event) => {
        const value = event.target.value;
        setMinElevation(value === "" ? 0 : Math.max(0, parseInt(value, 10) || 0));
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

            <div className="app-container glacier-map-container">
                <div className="glacier-map-header">
                    <h1>Nearest Mountain &#127956;</h1>
                    <nav className="glacier-map-nav">
                        <Link href={user ? `/glacier?lat=${user.lat}&lon=${user.lon}` : "/glacier"}>
                            nearest glacier &#129482;
                        </Link>
                    </nav>
                </div>

                <div className="glacier-map-controls">
                    <LocationLine user={user} locationFailed={locationFailed} onSubmit={setUser} />
                    <div className="explorer-controls-right">
                        <label className="glacier-map-area">
                            Min elevation (m)
                            <input
                                type="number"
                                value={minElevation}
                                onChange={handleElevationChange}
                                min="0"
                                step="100"
                                className="elevation-input"
                            />
                        </label>
                        <ViewToggle view={view} onChange={changeView} />
                    </div>
                </div>

                {view === "map" ? (
                    ready ? (
                        <MountainMap
                            user={user}
                            nearest={nearest}
                            callout={callout}
                            focus={focus}
                            minElevation={minElevation}
                            onPickLocation={setUser}
                            onSelectMountain={openCallout}
                            onCloseCallout={() => setCallout(null)}
                        />
                    ) : (
                        <div className="leaflet-map glacier-map glacier-map--loading">Finding your location…</div>
                    )
                ) : (
                    <MountainList user={user} list={nearestList} onShowOnMap={showOnMap} />
                )}

                <div className="explorer-footer">
                    <p className="glacier-map-hint">
                        {status ||
                            (view === "map"
                                ? "Click anywhere on the map to move your location, or click any dot for details."
                                : user
                                ? "The 10 nearest mountain ranges to your location."
                                : "Set a location to see the nearest ranges.")}
                    </p>
                    <button type="button" onClick={randomRange} className="random-peak-button">
                        &#9968; Random Mountain Range
                    </button>
                </div>
            </div>

            <div className="about about--wide">
                <button onClick={() => setShowAbout(true)}>about</button>
            </div>

            {showAbout && (
                <AboutOverlay onClose={() => setShowAbout(false)}>
                    <p>
                        Welcome to <code>nearestmountain.com</code>, a tool for people who are allergic to sea level. It
                        finds the closest mountain range to your current location. It uses the GMBA Mountain Inventory
                        database, cited below, and as a result it shows the geographic center of the nearest ranges, not
                        individual mountain peaks.
                    </p>
                    <p>
                        Click anywhere on the map to move your location, or click any dot to see that range. The list
                        view shows the 10 nearest ranges. The random button picks a random range from the GMBA database
                        that meets your elevation filter.
                    </p>
                    <p>
                        Looking for ice? <Link href="/glacier">nearestmountain.com/glacier</Link> does the same for the
                        world&apos;s glaciers.
                    </p>
                    <p>Background images: Nevado Sajama, Oruro, Bolivia &amp; Garnet Peak, California, USA.</p>
                    <p>
                        I can be reached at <code>me@michaelsalama.com</code>
                    </p>
                    <p className="citation">
                        Snethlage, M.A., Geschke, J., Spehn, E.M., Ranipeta, A., Yoccoz, N.G., Körner, Ch., Jetz, W.,
                        Fischer, M. &amp; Urbach, D. GMBA Mountain Inventory v2. GMBA-EarthEnv.
                        https://doi.org/10.48601/earthenv-t9k2-1407 (2022).
                    </p>
                </AboutOverlay>
            )}
        </div>
    );
}

function MountainList({ user, list, onShowOnMap }) {
    if (!user) return <div className="explorer-list explorer-list--empty">No location yet.</div>;
    if (!list) return <div className="explorer-list explorer-list--empty">Loading nearest mountains…</div>;
    return (
        <ol className="explorer-list">
            {list.map((m, i) => (
                <li key={m.id} className={i === 0 ? "is-nearest" : ""}>
                    <div className="explorer-list__rank">{i + 1}</div>
                    <div className="explorer-list__body">
                        <div className="explorer-list__name">{m.name}</div>
                        {m.parents ? <div className="explorer-list__sub">{m.parents}</div> : null}
                        <div className="explorer-list__facts">
                            <span>{formatDistance(m.distance)} away</span>
                            {Number.isFinite(m.elevation_high) ? (
                                <span>
                                    {Number.isFinite(m.elevation_low) ? `${m.elevation_low.toLocaleString()}–` : ""}
                                    {m.elevation_high.toLocaleString()} m
                                </span>
                            ) : null}
                            {m.countries ? <span>{m.countries}</span> : null}
                        </div>
                    </div>
                    <div className="explorer-list__actions">
                        <button type="button" onClick={() => onShowOnMap(m)}>
                            show on map
                        </button>
                        <a
                            href={`https://www.google.com/maps?q=${m.lat},${m.lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Google Maps ↗
                        </a>
                    </div>
                </li>
            ))}
        </ol>
    );
}
