"use client";

import { useEffect, useState } from "react";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function GamemasterPage() {
  const createEmptyRound = () => ({
    title: "",
    description: "",
    imageUrl: "",
    imageMode: "url",
    latLon: "",
    latitude: "",
    longitude: ""
  });

  const [form, setForm] = useState({
    key: "",
    date: todayIso(),
    rounds: Array.from({ length: 5 }, createEmptyRound)
  });
  const [unlocked, setUnlocked] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadExisting() {
      const res = await fetch(`/api/game/challenges?date=${form.date}`, {
        cache: "no-store"
      });
      const data = await res.json();
      const incomingRounds = data.challenge?.rounds || [];
      const paddedRounds = Array.from({ length: 5 }, (_, index) =>
        incomingRounds[index]
          ? {
              ...incomingRounds[index],
              imageMode: "url",
              latLon:
                incomingRounds[index].latitude !== "" &&
                incomingRounds[index].longitude !== ""
                  ? `${incomingRounds[index].latitude}, ${incomingRounds[index].longitude}`
                  : ""
            }
          : createEmptyRound()
      );

      setForm((prev) => ({
        ...prev,
        rounds: paddedRounds
      }));
      setStatus("");
    }
    loadExisting();
  }, [form.date]);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setRoundField = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      rounds: prev.rounds.map((round, roundIndex) =>
        roundIndex === index ? { ...round, [field]: value } : round
      )
    }));
  };

  const parseLatLonInput = (value, roundNumber) => {
    const [rawLat, rawLon] = (value || "").split(",").map((part) => part.trim());
    if (!rawLat || !rawLon) {
      throw new Error(`Round ${roundNumber}: Lat/Long must be in the format "latitude, longitude"`);
    }

    const parsedLat = Number(rawLat);
    const parsedLon = Number(rawLon);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLon)) {
      throw new Error(`Round ${roundNumber}: Lat/Long must contain valid numbers.`);
    }

    return { parsedLat, parsedLon };
  };

  const handleUpload = (event, roundIndex) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRoundField(roundIndex, "imageUrl", reader.result);
      setStatus(`Image uploaded locally for round ${roundIndex + 1}.`);
    };
    reader.readAsDataURL(file);
  };

  const onDragStart = (index) => setDragIndex(index);

  const onDrop = (targetIndex) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    setForm((prev) => {
      const nextRounds = [...prev.rounds];
      const [moved] = nextRounds.splice(dragIndex, 1);
      nextRounds.splice(targetIndex, 0, moved);
      return { ...prev, rounds: nextRounds };
    });
    setDragIndex(null);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!unlocked) {
      setStatus("Enter key and click Unlock Editor first.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const normalizedRounds = form.rounds.map((round, index) => {
        const { parsedLat, parsedLon } = parseLatLonInput(round.latLon, index + 1);
        return {
          ...round,
          latitude: parsedLat,
          longitude: parsedLon
        };
      });

      const payload = {
        ...form,
        rounds: normalizedRounds
      };

      const res = await fetch("/api/game/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save challenge");
      setForm(payload);
      setStatus(`Saved challenge for ${form.date}.`);
    } catch (e) {
      setStatus(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="gamemaster-shell">
      <h1>Gamemaster Dashboard</h1>
      <p>Create/edit all 5 rounds for the daily challenge shown on /play.</p>

      <form className="gamemaster-form" onSubmit={onSubmit}>
        <label>
          Gamemaster Key
          <input
            type="password"
            value={form.key}
            onChange={(e) => setField("key", e.target.value)}
            required
          />
        </label>
        {!unlocked ? (
          <button
            type="button"
            onClick={() => setUnlocked(Boolean(form.key.trim()))}
            disabled={!form.key.trim()}
          >
            Unlock Editor
          </button>
        ) : (
          <>
            <label>
              Date
              <input
                type="date"
                value={form.date}
                onChange={(e) => setField("date", e.target.value)}
                required
              />
            </label>

            <button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Challenge"}
            </button>
          </>
        )}
      </form>

      {status ? <p className="gamemaster-status">{status}</p> : null}

      {unlocked ? (
        <div className="gm-rounds-stack">
          {form.rounds.map((round, index) => (
            <div
              key={`round-card-${index}`}
              className="gm-round-card"
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(index)}
            >
              <div className="gm-round-header">
                <strong>Round {index + 1}</strong>
                <span className="gm-drag-hint">Drag to reorder</span>
              </div>

              <div className="gm-round-fields">
                <input
                  type="text"
                  value={round.title}
                  onChange={(e) => setRoundField(index, "title", e.target.value)}
                  placeholder="Title"
                  aria-label={`Round ${index + 1} title`}
                  required
                />

                <input
                  type="text"
                  value={round.description}
                  onChange={(e) => setRoundField(index, "description", e.target.value)}
                  placeholder="Description (optional)"
                  aria-label={`Round ${index + 1} description`}
                />

                <div className="round-tabs">
                  <button
                    type="button"
                    className={round.imageMode === "url" ? "active" : ""}
                    onClick={() => setRoundField(index, "imageMode", "url")}
                  >
                    URL
                  </button>
                  <button
                    type="button"
                    className={round.imageMode === "upload" ? "active" : ""}
                    onClick={() => setRoundField(index, "imageMode", "upload")}
                  >
                    Upload
                  </button>
                </div>

                {round.imageMode === "url" ? (
                  <input
                    type="url"
                    value={round.imageUrl}
                    onChange={(e) => setRoundField(index, "imageUrl", e.target.value)}
                    placeholder="Image URL (optional)"
                    aria-label={`Round ${index + 1} image URL`}
                  />
                ) : (
                  <input
                    type="file"
                    accept="image/*"
                    aria-label={`Round ${index + 1} upload image`}
                    onChange={(e) => handleUpload(e, index)}
                  />
                )}

                <input
                  type="text"
                  value={round.latLon}
                  onChange={(e) => setRoundField(index, "latLon", e.target.value)}
                  placeholder="Lat / Long (e.g. 37.09426, -118.514455)"
                  aria-label={`Round ${index + 1} latitude longitude`}
                  required
                />

              </div>

              {round.imageUrl ? (
                <div className="gamemaster-preview">
                  <img src={round.imageUrl} alt={`Round ${index + 1} preview`} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </main>
  );
}
