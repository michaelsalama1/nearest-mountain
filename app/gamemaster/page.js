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

function arrayMove(arr, from, to) {
  if (from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  if (from === to) return arr;
  const n = arr.slice();
  const [moved] = n.splice(from, 1);
  n.splice(to, 0, moved);
  return n;
}

/** Keep calendar window fixed; reassign `startDate + 0..4` to the current row order. */
function daysWithRoundsRestamped(startDate, days) {
  return days.map((d, i) => ({
    date: addDays(startDate, i),
    round: d.round
  }));
}

export default function GamemasterPage() {
  const createEmptyRound = () => ({
    title: "",
    description: "",
    imageUrl: "",
    hint: "",
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
  const [dragOverIndex, setDragOverIndex] = useState(null);

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

  const moveRow = (from, to) => {
    setForm((prev) => {
      const next = arrayMove(prev.days, from, to);
      return { ...prev, days: daysWithRoundsRestamped(prev.startDate, next) };
    });
  };

  const shuffleRows = () => {
    setForm((prev) => {
      const rounds = prev.days.map((d) => d.round);
      for (let i = rounds.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [rounds[i], rounds[j]] = [rounds[j], rounds[i]];
      }
      return {
        ...prev,
        days: daysWithRoundsRestamped(
          prev.startDate,
          rounds.map((round) => ({ date: prev.startDate, round }))
        )
      };
    });
  };

  const onDragStartRow = (e, index) => {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDropOnRow = (e, toIndex) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (Number.isNaN(from)) return;
    moveRow(from, toIndex);
    setDragOverIndex(null);
  };

  /** Lenient: empty or invalid lat/lon → 0,0 so partial rounds can be saved. */
  const parseLatLonForSave = (value) => {
    const trimmed = (value || "").trim();
    if (!trimmed) return { lat: 0, lon: 0 };
    const i = trimmed.indexOf(",");
    if (i === -1) return { lat: 0, lon: 0 };
    const rawLat = trimmed.slice(0, i).trim();
    const rawLon = trimmed.slice(i + 1).trim();
    if (rawLat === "" || rawLon === "") return { lat: 0, lon: 0 };
    const lat = Number(rawLat);
    const lon = Number(rawLon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return { lat: 0, lon: 0 };
    return {
      lat: Math.min(90, Math.max(-90, lat)),
      lon: Math.min(180, Math.max(-180, lon))
    };
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
        const { lat, lon } = parseLatLonForSave(round.latLon);
        const payload = {
          key: form.key,
          date: day.date,
          rounds: [
            {
              ...round,
              title: round.title ?? "",
              description: round.description ?? "",
              imageUrl: round.imageUrl ?? "",
              hint: round.hint ?? "",
              latitude: lat,
              longitude: lon
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
            autoComplete="off"
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

          <div className="gm-reorder-bar">
            <p className="gm-reorder-bar__text">
              Reorder rows to change which challenge applies to which calendar day in this window, then
              save.
            </p>
            <button
              type="button"
              className="gm-shuffle-btn"
              onClick={shuffleRows}
              disabled={loading}
            >
              Shuffle 5 days
            </button>
          </div>

        <div className="gm-rounds-stack">
          {form.days.map((day, index) => (
            <div
              key={`day-card-${day.date}`}
              className={
                "gm-round-card" +
                (dragOverIndex === index ? " gm-round-card--drop-target" : "")
              }
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverIndex(index);
              }}
              onDrop={(e) => onDropOnRow(e, index)}
            >
              <div className="gm-round-header">
                <div className="gm-round-header__left">
                  <span
                    className="gm-drag-handle"
                    draggable
                    onDragStart={(e) => onDragStartRow(e, index)}
                    onDragEnd={() => setDragOverIndex(null)}
                    title="Drag to reorder"
                    aria-label={`Drag to reorder row for ${day.date}`}
                  >
                    ⠿
                  </span>
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
                <div className="gm-round-header__right" role="group" aria-label="Row position">
                  <div className="gm-row-nudge">
                    <button
                      type="button"
                      className="gm-row-nudge__btn"
                      onClick={() => moveRow(index, index - 1)}
                      disabled={index === 0 || loading}
                      title="Move up in list"
                      aria-label="Move this row up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="gm-row-nudge__btn"
                      onClick={() => moveRow(index, index + 1)}
                      disabled={index === form.days.length - 1 || loading}
                      title="Move down in list"
                      aria-label="Move this row down"
                    >
                      ↓
                    </button>
                  </div>
                  <span className="gm-drag-hint">1 round</span>
                </div>
              </div>

              <div className="gm-round-fields">
                <input
                  type="text"
                  value={day.round.title}
                  onChange={(e) => setRoundField(index, "title", e.target.value)}
                  placeholder="Title"
                  aria-label={`${day.date} title`}
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
