"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from "react-leaflet";

export default function FinalResultsMap({ roundResults, rounds }) {
  return (
    <div className="final-results-map-wrapper">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        className="final-results-map"
        worldCopyJump
      >
        <TileLayer
          attribution="© OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {(roundResults || [])
          .filter((item) => item && item.round >= 1)
          .map((item) => {
          const fallbackRound = rounds?.[item.round - 1];
          const title = fallbackRound?.title || item.title || `Round ${item.round}`;
          const description = fallbackRound?.description || item.description || "";

          return <div key={`round-map-${item.round}`}>
            <CircleMarker
              center={[item.guess.lat, item.guess.lon]}
              radius={7}
              pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.85 }}
            />

            <CircleMarker
              center={[item.actual.lat, item.actual.lon]}
              radius={7}
              pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.85 }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1} permanent>
                <div>
                  <strong>{title}</strong>
                  {description ? <div>{description}</div> : null}
                  <div>{item.distanceKm.toFixed(1)} km</div>
                </div>
              </Tooltip>
            </CircleMarker>

            <Polyline
              positions={[
                [item.guess.lat, item.guess.lon],
                [item.actual.lat, item.actual.lon]
              ]}
              pathOptions={{ color: "#1f2937", dashArray: "6 6" }}
            />
          </div>;
        })}
      </MapContainer>
    </div>
  );
}
