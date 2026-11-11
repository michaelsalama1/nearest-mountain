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
} from "../_components/explorer";

const GlacierMap = dynamic(() => import("../_components/GlacierMap"), {
    ssr: false,
    loading: () => <div className="leaflet-map glacier-map glacier-map--loading">Loading map…</div>,
});

function formatArea(km2) {
    if (km2 >= 1) return `${km2.toLocaleString(undefined, { maximumFractionDigits: 2 })} km²`;
    return `${km2.toFixed(3)} km² (${Math.round(km2 * 100)} ha)`;
}

export default function GlacierPage() {
    const router = useRouter();
    const { user, setUser, ready, locationFailed, params } = useExplorerLocation();
    const [view, setView] = useState("map");
    const [minArea, setMinArea] = useState(0.2);
    const [nearestList, setNearestList] = useState(null);
    const [status, setStatus] = useState("");
    const [callout, setCallout] = useState(null); // { glacier, key }
    const [focus, setFocus] = useState(null); // { lat, lon, key }
    const [showAbout, setShowAbout] = useState(false);
    const counter = useRef(0);
    const nearest = nearestList?.[0] ?? null;

    const openCallout = (glacier) => {
        counter.current += 1;
        setCallout(glacier ? { glacier, key: counter.current } : null);
    };

    const showOnMap = (glacier) => {
        counter.current += 1;
        setCallout({ glacier, key: counter.current });
        setFocus({ lat: glacier.lat, lon: glacier.lon, key: counter.current });
        setView("map");
    };

    useEffect(() => {
        if (!params) return;
        const a = parseFloat(params.get("a"));
        if (Number.isFinite(a)) setMinArea(a);
        if (params.get("view") === "list") setView("list");
    }, [params]);

    useEffect(() => {
        if (!user) return;
        setStatus("Finding the nearest glacier…");
        let cancelled = false;
        fetch(`/api/nearestGlacier?lat=${user.lat}&lon=${user.lon}&minArea=${minArea}`)
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                if (!Array.isArray(data) || data.length === 0) {
                    setNearestList(null);
                    setCallout(null);
                    setStatus(data?.error || "No glacier found.");
                    return;
                }
                setNearestList(data);
                openCallout(data[0]);
                setStatus("");
            })
            .catch(() => !cancelled && setStatus("Could not load glaciers."));
        return () => {
            cancelled = true;
        };
    }, [user, minArea]);

    useEffect(() => {
        if (!user) return;
        const q = new URLSearchParams({ lat: user.lat, lon: user.lon, a: minArea });
        if (view === "list") q.set("view", "list");
        router.replace(`/glacier?${q}`, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, minArea, view]);

    const changeView = (v) => {
        if (v === "list") setFocus(null);
        setView(v);
    };

    const randomGlacier = () => {
        fetch(`/api/randomGlacier?minArea=${minArea}`)
            .then((res) => res.json())
            .then((data) => {
                if (!Array.isArray(data) || !data[0]) return setStatus(data?.error || "No glacier found.");
                showOnMap(data[0]);
            })
            .catch(() => setStatus("Could not load a random glacier."));
    };

    const handleAreaChange = (event) => {
        const value = event.target.value;
        setMinArea(value === "" ? 0 : Math.max(0, parseFloat(value) || 0));
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
                    <h1>Nearest Glacier &#129482;</h1>
                    <nav className="glacier-map-nav">
                        <Link href={user ? `/?lat=${user.lat}&lon=${user.lon}` : "/"}>nearest mountain &#127956;</Link>
                    </nav>
                </div>

                <div className="glacier-map-controls">
                    <LocationLine user={user} locationFailed={locationFailed} onSubmit={setUser} />
                    <div className="explorer-controls-right">
                        <label className="glacier-map-area">
                            Min size (km²)
                            <input
                                type="number"
                                value={minArea}
                                onChange={handleAreaChange}
                                min="0"
                                step="0.1"
                                className="elevation-input"
                            />
                        </label>
                        <ViewToggle view={view} onChange={changeView} />
                    </div>
                </div>

                {view === "map" ? (
                    ready ? (
                        <GlacierMap
                            user={user}
                            nearest={nearest}
                            callout={callout}
                            focus={focus}
                            minArea={minArea}
                            onPickLocation={setUser}
                            onSelectGlacier={openCallout}
                            onCloseCallout={() => setCallout(null)}
                        />
                    ) : (
                        <div className="leaflet-map glacier-map glacier-map--loading">Finding your location…</div>
                    )
                ) : (
                    <GlacierList user={user} list={nearestList} onShowOnMap={showOnMap} />
                )}

                <div className="explorer-footer">
                    <p className="glacier-map-hint">
                        {status ||
                            (view === "map"
                                ? "Click anywhere on the map to move your location, or click any dot for details."
                                : user
                                ? "The 10 nearest glaciers to your location."
                                : "Set a location to see the nearest glaciers.")}
                    </p>
                    <button type="button" onClick={randomGlacier} className="random-peak-button">
                        &#129482; Random Glacier
                    </button>
                </div>
            </div>

            <div className="about about--wide">
                <button onClick={() => setShowAbout(true)}>about</button>
            </div>

            {showAbout && (
                <AboutOverlay onClose={() => setShowAbout(false)}>
                    <p>
                        <code>nearestmountain.com/glacier</code> finds the closest glaciers to your location using the
                        GLIMS (Global Land Ice Measurements from Space) glacier database, about 390,000 glaciers
                        worldwide. Each dot is a representative point inside the glacier&apos;s mapped outline, from
                        that glacier&apos;s most recent GLIMS analysis.
                    </p>
                    <p>
                        Click anywhere on the map to move your location, or click any dot to see that glacier. Zoomed
                        out, the map shows the largest glaciers in each area; zoom in to see them all. The minimum size
                        filter skips small ice patches, and the list view shows the 10 nearest glaciers.
                    </p>
                    <p>
                        Prefer rock? <Link href="/">nearestmountain.com</Link> finds the nearest mountain range.
                    </p>
                    <p>
                        I can be reached at <code>me@michaelsalama.com</code>
                    </p>
                    <p className="citation">
                        GLIMS Consortium. GLIMS Glacier Database, Version 1. Boulder, Colorado USA. NSIDC: National
                        Snow and Ice Data Center. https://doi.org/10.7265/N5V98602 (2005, updated 2024).
                    </p>
                </AboutOverlay>
            )}
        </div>
    );
}

function GlacierList({ user, list, onShowOnMap }) {
    if (!user) return <div className="explorer-list explorer-list--empty">No location yet.</div>;
    if (!list) return <div className="explorer-list explorer-list--empty">Loading nearest glaciers…</div>;
    return (
        <ol className="explorer-list">
            {list.map((g, i) => (
                <li key={g.id} className={i === 0 ? "is-nearest" : ""}>
                    <div className="explorer-list__rank">{i + 1}</div>
                    <div className="explorer-list__body">
                        <div className="explorer-list__name">{g.name || "Unnamed glacier"}</div>
                        {g.region ? <div className="explorer-list__sub">{g.region}</div> : null}
                        <div className="explorer-list__facts">
                            <span>{formatDistance(g.distance)} away</span>
                            <span>{formatArea(g.area)}</span>
                            {g.max_elev ? (
                                <span>
                                    {g.min_elev ? `${g.min_elev.toLocaleString()}–` : ""}
                                    {g.max_elev.toLocaleString()} m
                                </span>
                            ) : null}
                        </div>
                    </div>
                    <div className="explorer-list__actions">
                        <button type="button" onClick={() => onShowOnMap(g)}>
                            show on map
                        </button>
                        <a
                            href={`https://www.google.com/maps/@${g.lat},${g.lon},3000m/data=!3m1!1e3`}
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
