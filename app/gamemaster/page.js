"use client";

import { useEffect, useState } from "react";
import { getGameCalendarDateYMD } from "../../lib/calendarDate";

function todayIso() {
  return getGameCalendarDateYMD();
}

function addDays(isoDate, amount) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

export default function GamemasterPage() {
  const createEmptyRound = () => ({
    title: "",
    description: "",
    imageUrl: "",
    latLon: "",
    latitude: "",
    longitude: ""
  });

  const createEmptyDayEntry = (date) => ({
    date,
    round: createEmptyRound()
  });

  const buildFiveDayWindow = (startDate) =>
    Array.from({ length: 5 }, (_, i) => createEmptyDayEntry(addDays(startDate, i)));

  const [form, setForm] = useState({
    key: "",
    startDate: todayIso(),
    days: buildFiveDayWindow(todayIso())
  });
  const [unlocked, setUnlocked] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadExisting() {
      const dates = Array.from({ length: 5 }, (_, i) => addDays(form.startDate, i));
      const responses = await Promise.all(
        dates.map(async (date) => {
          const res = await fetch(`/api/game/challenges?date=${date}`, { cache: "no-store" });
          let data = {};
          try {
            data = await res.json();
          } catch {
            data = {};
          }
          if (!res.ok) {
            return { date, round: createEmptyRound(), error: data.error || `Failed to load ${date}` };
          }
          const firstRound = data.challenge?.rounds?.[0];
          if (!firstRound) return { date, round: createEmptyRound() };
          return {
            date,
            round: {
              ...firstRound,
              latLon:
                firstRound.latitude !== "" && firstRound.longitude !== ""
                  ? `${firstRound.latitude}, ${firstRound.longitude}`
                  : ""
            }
          };
        })
      );

      const nextDays = responses.map((item) => ({ date: item.date, round: item.round }));
      const firstError = responses.find((item) => item.error)?.error;
      setForm((prev) => ({ ...prev, days: nextDays }));
      setStatus(firstError || "");
    }
    loadExisting();
  }, [form.startDate]);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setRoundField = (dayIndex, field, value) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.map((day, index) =>
        index === dayIndex ? { ...day, round: { ...day.round, [field]: value } } : day
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

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!unlocked) {
      setStatus("Enter key and click Unlock Editor first.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      for (const day of form.days) {
        const round = day.round;
        const { parsedLat, parsedLon } = parseLatLonInput(round.latLon, day.date);
        const payload = {
          key: form.key,
          date: day.date,
          rounds: [
            {
              ...round,
              latitude: parsedLat,
              longitude: parsedLon
            }
          ]
        };

        const res = await fetch("/api/game/challenges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        let data = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }
        if (!res.ok) throw new Error(data.error || `Failed to save challenge for ${day.date}`);
      }
      setStatus(`Saved 5 days starting ${form.startDate}.`);
    } catch (e) {
      setStatus(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="gamemaster-shell">
      <h1>Gamemaster Dashboard</h1>
      <p>Create/edit one round per day. This editor shows 5 days at a time.</p>

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
            <button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save 5 Days"}
            </button>
          </>
        )}
      </form>

      {status ? <p className="gamemaster-status">{status}</p> : null}

      {unlocked ? (
        <>
          <div className="gm-window-nav">
            <button
              type="button"
              onClick={() => setField("startDate", addDays(form.startDate, -5))}
              disabled={loading}
            >
              ← Previous 5 days
            </button>
            <strong>
              {form.startDate} to {addDays(form.startDate, 4)}
            </strong>
            <button
              type="button"
              onClick={() => setField("startDate", addDays(form.startDate, 5))}
              disabled={loading}
            >
              Next 5 days →
            </button>
          </div>

        <div className="gm-rounds-stack">
          {form.days.map((day, index) => (
            <div
              key={`day-card-${day.date}`}
              className="gm-round-card"
            >
              <div className="gm-round-header">
                <div className="gm-round-header__left">
                  <strong>{day.date}</strong>
                  <a
                    className="gm-test-link"
                    href={`/play?id=${encodeURIComponent(day.date)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Test in /play
                  </a>
                </div>
                <span className="gm-drag-hint">1 round</span>
              </div>

              <div className="gm-round-fields">
                <input
                  type="text"
                  value={day.round.title}
                  onChange={(e) => setRoundField(index, "title", e.target.value)}
                  placeholder="Title"
                  aria-label={`${day.date} title`}
                  required
                />

                <input
                  type="text"
                  value={day.round.description}
                  onChange={(e) => setRoundField(index, "description", e.target.value)}
                  placeholder="Description"
                  aria-label={`${day.date} description`}
                />

                <input
                  type="url"
                  value={day.round.imageUrl}
                  onChange={(e) => setRoundField(index, "imageUrl", e.target.value)}
                  placeholder="Image URL"
                  aria-label={`${day.date} image URL`}
                />

                <input
                  type="text"
                  value={day.round.latLon}
                  onChange={(e) => setRoundField(index, "latLon", e.target.value)}
                  placeholder="Lat / Long (e.g. 37.09426, -118.514455)"
                  aria-label={`${day.date} latitude longitude`}
                  required
                />

              </div>

              {day.round.imageUrl ? (
                <div className="gamemaster-preview">
                  <img src={day.round.imageUrl} alt={`${day.date} preview`} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
        </>
      ) : null}
    </main>
  );
}
