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
    dot: "#38bdf8",
    dotStroke: "#0c4a6e",
    nearest: "#f97316",
    selected: "#facc15",
    user: "#2563eb",
};

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

function formatArea(km2) {
    if (km2 >= 1) return `${km2.toLocaleString(undefined, { maximumFractionDigits: 2 })} km²`;
    return `${km2.toFixed(3)} km² (${Math.round(km2 * 100)} ha)`;
}

function formatDistance(km) {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toLocaleString(undefined, { maximumFractionDigits: km < 100 ? 1 : 0 })} km`;
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
        const zoom = Math.max(map.getZoom(), focus.zoom ?? 11);
        const pt = map.project([focus.lat, focus.lon], zoom).subtract([0, 110]);
        map.flyTo(map.unproject(pt, zoom), zoom, { duration: 0.8 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focus?.key]);
    return null;
}

/** When the nearest glacier changes, frame the user and that glacier. */
function FrameNearest({ user, nearest }) {
    const map = useMap();
    const nearestId = nearest?.id;
    useEffect(() => {
        if (!user || !nearest) return;
        const bounds = [
            [user.lat, user.lon],
            [nearest.lat, nearest.lon],
        ];
        // Extra top padding leaves room for the callout above the glacier,
        // so the popup never has to pan the map itself.
        map.fitBounds(bounds, {
            paddingTopLeft: [60, 240],
            paddingBottomRight: [60, 50],
            maxZoom: 12,
            animate: true,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nearestId, user?.lat, user?.lon]);
    return null;
}

function GlacierCallout({ glacier, user, isNearest, onClose }) {
    const distance = user ? haversine(user.lat, user.lon, glacier.lat, glacier.lon) : null;

    // Stable props: a new position array on every render makes react-leaflet call
    // setLatLng, which redraws the popup (flicker) and re-runs autoPan (map bump).
    const position = useMemo(() => [glacier.lat, glacier.lon], [glacier.lat, glacier.lon]);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const eventHandlers = useMemo(() => ({ remove: () => onCloseRef.current() }), []);

    return (
        <Popup
            position={position}
            closeOnClick={false}
            // Pan once when a clicked dot's box would open off-screen; after that the
            // user can browse freely. The nearest glacier is framed by FrameNearest.
            autoPan={!isNearest}
            autoPanPadding={[40, 40]}
            offset={[0, -6]}
            eventHandlers={eventHandlers}
        >
            <div className="glacier-callout">
                {isNearest ? <div className="glacier-callout__tag">Nearest glacier</div> : null}
                <div className="glacier-callout__name">{glacier.name || "Unnamed glacier"}</div>
                {glacier.region ? <div className="glacier-callout__region">{glacier.region}</div> : null}
                <dl>
                    {distance != null ? (
                        <>
                            <dt>Distance</dt>
                            <dd>{formatDistance(distance)}</dd>
                        </>
                    ) : null}
                    <dt>Size</dt>
                    <dd>{formatArea(glacier.area)}</dd>
                    {glacier.max_elev ? (
                        <>
                            <dt>Elevation</dt>
                            <dd>
                                {glacier.min_elev ? `${glacier.min_elev.toLocaleString()}–` : ""}
                                {glacier.max_elev.toLocaleString()} m
                            </dd>
                        </>
                    ) : null}
                    <dt>Location</dt>
                    <dd>
                        {glacier.lat.toFixed(3)}, {glacier.lon.toFixed(3)}
                    </dd>
                </dl>
                <div className="glacier-callout__footer">
                    <span className="glacier-callout__id">{glacier.id}</span>
                    <a
                        href={`https://www.google.com/maps/@${glacier.lat},${glacier.lon},3000m/data=!3m1!1e3`}
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

export default function GlacierMap({
    user,
    nearest,
    callout, // { glacier, key } or null
    minArea,
    onPickLocation,
    onSelectGlacier,
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
        const z = m.getZoom();
        const id = ++reqRef.current;
        const q = new URLSearchParams({
            s: b.getSouth().toFixed(4),
            w: b.getWest().toFixed(4),
            n: b.getNorth().toFixed(4),
            e: b.getEast().toFixed(4),
            z: String(z),
            minArea: String(minArea || 0),
        });
        fetch(`/api/glaciersInView?${q}`)
            .then((res) => res.json())
            .then((data) => {
                if (id !== reqRef.current || !Array.isArray(data.glaciers)) return; // stale
                setDots(
                    data.glaciers.map(([gid, name, lat, lon, area, min_elev, max_elev, region]) => ({
                        id: gid,
                        name,
                        lat,
                        lon,
                        area,
                        min_elev,
                        max_elev,
                        region,
                    }))
                );
            })
            .catch((err) => console.error("Error loading glaciers:", err));
    };

    useEffect(() => {
        loadDots();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [minArea]);

    // Leaflet fires "remove" on the old popup when a new one replaces it; only
    // treat it as a user close if it belongs to the callout currently showing.
    const calloutKeyRef = useRef(null);
    calloutKeyRef.current = callout?.key ?? null;
    const selected = callout?.glacier || null;

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
                zoom={user ? 8 : 2}
                minZoom={2}
                className="leaflet-map glacier-map"
                worldCopyJump
                preferCanvas
            >
                <TileLayer attribution={BASEMAPS[basemap].attribution} url={BASEMAPS[basemap].url} />
                <MapEvents onPickLocation={onPickLocation} onViewChange={loadDots} />
                <FrameNearest user={user} nearest={nearest} />
                <FocusOn focus={focus} />

                {dots.map((g) => (
                    <CircleMarker
                        key={g.id}
                        center={[g.lat, g.lon]}
                        radius={g.area >= 10 ? 5 : g.area >= 1 ? 4 : 3}
                        bubblingMouseEvents={false}
                        pathOptions={{
                            color: COLORS.dotStroke,
                            weight: 1,
                            fillColor: COLORS.dot,
                            fillOpacity: 0.85,
                        }}
                        eventHandlers={{ click: () => onSelectGlacier(g) }}
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
                        eventHandlers={{ click: () => onSelectGlacier(nearest) }}
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
                    <GlacierCallout
                        key={callout.key}
                        glacier={callout.glacier}
                        user={user}
                        isNearest={callout.glacier.id === nearest?.id}
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
                <span><i style={{ background: COLORS.dot }} /> Glacier</span>
            </div>
        </div>
    );
}
