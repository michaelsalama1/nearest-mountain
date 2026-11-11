"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
    MapContainer,
    TileLayer,
    CircleMarker,
    Polyline,
    Popup,
    useMap,
    useMapEvents,
} from "react-leaflet";

const BASEMAPS = {
    satellite: {
        label: "Satellite",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
    },
    street: {
        label: "Street",
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: "© OpenStreetMap contributors",
    },
};

const COLORS = {
    dot: "#f8fafc",
    dotStroke: "#1f2937",
    nearest: "#f97316",
    selected: "#facc15",
    user: "#2563eb",
};

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toLocaleString(undefined, { maximumFractionDigits: km < 100 ? 1 : 0 })} km`;
}

function dotRadius(areaKm2) {
    if (areaKm2 >= 50000) return 7;
    if (areaKm2 >= 5000) return 5.5;
    if (areaKm2 >= 500) return 4.5;
    return 3.5;
}

/** Map clicks move the user's location; viewport changes refetch the dots. */
function MapEvents({ onPickLocation, onViewChange }) {
    const map = useMapEvents({
        click(event) {
            const { lat, lng } = event.latlng;
            const lon = ((((lng + 180) % 360) + 360) % 360) - 180;
            onPickLocation({ lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) });
        },
        // Hide the callout while panning/zooming; it fades back in when the map settles.
        movestart() {
            map.getContainer().classList.add("is-moving");
        },
        moveend() {
            map.getContainer().classList.remove("is-moving");
            onViewChange(map);
        },
    });

    useEffect(() => {
        onViewChange(map);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}

/** Fly to a point when asked (random pick, "show on map" from the list). */
function FocusOn({ focus }) {
    const map = useMap();
    useEffect(() => {
        if (!focus) return;
        // nudge the target below center so its callout has room above it
        const zoom = Math.max(map.getZoom(), focus.zoom ?? 7);
        const pt = map.project([focus.lat, focus.lon], zoom).subtract([0, 110]);
        map.flyTo(map.unproject(pt, zoom), zoom, { duration: 0.8 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focus?.key]);
    return null;
}

/** When the nearest range changes, frame the user and that range's center. */
function FrameNearest({ user, nearest }) {
    const map = useMap();
    const nearestId = nearest?.id;
    useEffect(() => {
        if (!user || !nearest) return;
        map.fitBounds(
            [
                [user.lat, user.lon],
                [nearest.lat, nearest.lon],
            ],
            {
                // Extra top padding leaves room for the callout above the dot.
                paddingTopLeft: [60, 260],
                paddingBottomRight: [60, 50],
                maxZoom: 9,
                animate: true,
            }
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nearestId, user?.lat, user?.lon]);
    return null;
}

function MountainCallout({ mountain, user, isNearest, onClose }) {
    const distance = user ? haversine(user.lat, user.lon, mountain.lat, mountain.lon) : null;

    // Stable props so re-renders don't redraw the popup or re-run autoPan.
    const position = useMemo(() => [mountain.lat, mountain.lon], [mountain.lat, mountain.lon]);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const eventHandlers = useMemo(() => ({ remove: () => onCloseRef.current() }), []);

    return (
        <Popup
            position={position}
            closeOnClick={false}
            autoPan={!isNearest}
            autoPanPadding={[40, 40]}
            offset={[0, -6]}
            eventHandlers={eventHandlers}
        >
            <div className="glacier-callout">
                {isNearest ? <div className="glacier-callout__tag">Nearest mountain range</div> : null}
                <div className="glacier-callout__name">{mountain.name}</div>
                {mountain.parents ? <div className="glacier-callout__region">{mountain.parents}</div> : null}
                <dl>
                    {distance != null ? (
                        <>
                            <dt>Distance</dt>
                            <dd>{formatDistance(distance)}</dd>
                        </>
                    ) : null}
                    {Number.isFinite(mountain.elevation_high) ? (
                        <>
                            <dt>Elevation</dt>
                            <dd>
                                {Number.isFinite(mountain.elevation_low)
                                    ? `${mountain.elevation_low.toLocaleString()}–`
                                    : ""}
                                {mountain.elevation_high.toLocaleString()} m
                            </dd>
                        </>
                    ) : null}
                    {mountain.area ? (
                        <>
                            <dt>Area</dt>
                            <dd>{Math.round(mountain.area).toLocaleString()} km²</dd>
                        </>
                    ) : null}
                    {mountain.countries ? (
                        <>
                            <dt>Countries</dt>
                            <dd>{mountain.countries}</dd>
                        </>
                    ) : null}
                    <dt>Center</dt>
                    <dd>
                        {mountain.lat.toFixed(3)}, {mountain.lon.toFixed(3)}
                    </dd>
                </dl>
                <div className="glacier-callout__footer">
                    <span className="glacier-callout__id">GMBA {mountain.id}</span>
                    <a
                        href={`https://www.google.com/maps?q=${mountain.lat},${mountain.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Google Maps ↗
                    </a>
                </div>
            </div>
        </Popup>
    );
}

export default function MountainMap({
    user,
    nearest,
    callout, // { mountain, key } or null
    minElevation,
    onPickLocation,
    onSelectMountain,
    onCloseCallout,
    focus, // { lat, lon, zoom?, key } or null
}) {
    const [basemap, setBasemap] = useState("satellite");
    const [dots, setDots] = useState([]);
    const viewRef = useRef(null);
    const reqRef = useRef(0);

    const loadDots = (map) => {
        if (map) viewRef.current = map;
        const m = viewRef.current;
        if (!m) return;
        const b = m.getBounds();
        const id = ++reqRef.current;
        const q = new URLSearchParams({
            s: b.getSouth().toFixed(4),
            w: b.getWest().toFixed(4),
            n: b.getNorth().toFixed(4),
            e: b.getEast().toFixed(4),
            z: String(m.getZoom()),
            minElevation: String(minElevation || 0),
        });
        fetch(`/api/mountainMap/inView?${q}`)
            .then((res) => res.json())
            .then((data) => {
                if (id !== reqRef.current || !Array.isArray(data.mountains)) return; // stale
                setDots(
                    data.mountains.map(
                        ([mid, name, lat, lon, elevation_low, elevation_high, area, parents, countries]) => ({
                            id: mid,
                            name,
                            lat,
                            lon,
                            elevation_low,
                            elevation_high,
                            area,
                            parents,
                            countries,
                        })
                    )
                );
            })
            .catch((err) => console.error("Error loading mountains:", err));
    };

    useEffect(() => {
        loadDots();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [minElevation]);

    // Leaflet fires "remove" on the old popup when a new one replaces it; only
    // treat it as a user close if it belongs to the callout currently showing.
    const calloutKeyRef = useRef(null);
    calloutKeyRef.current = callout?.key ?? null;
    const selected = callout?.mountain || null;

    return (
        <div className="leaflet-map-wrapper">
            <div className="map-style-toggle">
                {Object.entries(BASEMAPS).map(([key, value]) => (
                    <button
                        key={key}
                        type="button"
                        className={basemap === key ? "active" : ""}
                        onClick={() => setBasemap(key)}
                    >
                        {value.label}
                    </button>
                ))}
            </div>

            <MapContainer
                center={user ? [user.lat, user.lon] : [20, 0]}
                zoom={user ? 6 : 2}
                minZoom={2}
                className="leaflet-map glacier-map"
                worldCopyJump
                preferCanvas
            >
                <TileLayer attribution={BASEMAPS[basemap].attribution} url={BASEMAPS[basemap].url} />
                <MapEvents onPickLocation={onPickLocation} onViewChange={loadDots} />
                <FrameNearest user={user} nearest={nearest} />
                <FocusOn focus={focus} />

                {dots.map((m) => (
                    <CircleMarker
                        key={m.id}
                        center={[m.lat, m.lon]}
                        radius={dotRadius(m.area)}
                        bubblingMouseEvents={false}
                        pathOptions={{
                            color: COLORS.dotStroke,
                            weight: 1.5,
                            fillColor: COLORS.dot,
                            fillOpacity: 0.9,
                        }}
                        eventHandlers={{ click: () => onSelectMountain(m) }}
                    />
                ))}

                {user && nearest ? (
                    <Polyline
                        positions={[
                            [user.lat, user.lon],
                            [nearest.lat, nearest.lon],
                        ]}
                        interactive={false}
                        pathOptions={{ color: COLORS.nearest, weight: 2, dashArray: "6 6" }}
                    />
                ) : null}

                {selected && selected.id !== nearest?.id ? (
                    <CircleMarker
                        center={[selected.lat, selected.lon]}
                        radius={8}
                        bubblingMouseEvents={false}
                        pathOptions={{ color: "#111827", weight: 2, fillColor: COLORS.selected, fillOpacity: 1 }}
                    />
                ) : null}

                {nearest ? (
                    <CircleMarker
                        center={[nearest.lat, nearest.lon]}
                        radius={9}
                        bubblingMouseEvents={false}
                        pathOptions={{ color: "#ffffff", weight: 3, fillColor: COLORS.nearest, fillOpacity: 1 }}
                        eventHandlers={{ click: () => onSelectMountain(nearest) }}
                    />
                ) : null}

                {user ? (
                    <CircleMarker
                        center={[user.lat, user.lon]}
                        radius={7}
                        interactive={false}
                        pathOptions={{ color: "#ffffff", weight: 3, fillColor: COLORS.user, fillOpacity: 1 }}
                    />
                ) : null}

                {callout ? (
                    <MountainCallout
                        key={callout.key}
                        mountain={callout.mountain}
                        user={user}
                        isNearest={callout.mountain.id === nearest?.id}
                        onClose={() => {
                            const k = callout.key;
                            setTimeout(() => {
                                if (calloutKeyRef.current === k) onCloseCallout();
                            }, 0);
                        }}
                    />
                ) : null}
            </MapContainer>

            <div className="glacier-map-legend">
                <span><i style={{ background: COLORS.user }} /> You</span>
                <span><i style={{ background: COLORS.nearest }} /> Nearest</span>
                <span><i style={{ background: COLORS.dot }} /> Range center</span>
            </div>
        </div>
    );
}
