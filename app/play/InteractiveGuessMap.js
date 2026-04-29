"use client";

import { useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  useMapEvents
} from "react-leaflet";

function ClickHandler({ onGuessPlaced, canPlaceGuess }) {
  useMapEvents({
    click(event) {
      if (!canPlaceGuess) return;
      const { lat, lng } = event.latlng;
      onGuessPlaced({
        lat: Number(lat.toFixed(4)),
        lon: Number(lng.toFixed(4))
      });
    }
  });

  return null;
}

const BASEMAPS = {
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics"
  },
  street: {
    label: "Street",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors"
  }
};

export default function InteractiveGuessMap({
  guess,
  attempts = [],
  submitted,
  challenge,
  canPlaceGuess,
  onGuessPlaced
}) {
  const [basemap, setBasemap] = useState("satellite");

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
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        className="leaflet-map"
        worldCopyJump
      >
        <TileLayer attribution={BASEMAPS[basemap].attribution} url={BASEMAPS[basemap].url} />
        <ClickHandler onGuessPlaced={onGuessPlaced} canPlaceGuess={canPlaceGuess} />

        {guess ? (
          <CircleMarker
            center={[guess.lat, guess.lon]}
            radius={8}
            pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.8 }}
          />
        ) : null}

        {attempts.map((attempt) =>
          attempt?.guess ? (
            <CircleMarker
              key={`attempt-${attempt.tryNumber}`}
              center={[attempt.guess.lat, attempt.guess.lon]}
              radius={6}
              pathOptions={{
                color: "#cbd5e1",
                fillColor: "#cbd5e1",
                fillOpacity: 0.12,
                dashArray: "2 6"
              }}
            />
          ) : null
        )}

        {submitted ? (
          <>
            <CircleMarker
              center={[challenge.latitude, challenge.longitude]}
              radius={8}
              pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.85 }}
            />
            {guess ? (
              <Polyline
                positions={[
                  [guess.lat, guess.lon],
                  [challenge.latitude, challenge.longitude]
                ]}
                pathOptions={{ color: "#111827", dashArray: "6 6" }}
              />
            ) : null}
          </>
        ) : null}
      </MapContainer>
    </div>
  );
}
