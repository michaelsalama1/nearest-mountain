"use client";

import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";

const InteractiveGuessMap = dynamic(() => import("./InteractiveGuessMap"), { ssr: false });

const SUMMIT_DISTANCE_KM = 2.5;
const LEAVE_NO_TRACE_URL =
  "https://lnt.org/why/7-principles/?gad_source=1&gad_campaignid=18565554164&gbraid=0AAAAADFQyoq7FQPJLmdZkhr4lmfpKTemO&gclid=EAIaIQobChMItcv3-4GHlAMVvzIIBR07YR2DEAAYAiAAEgK8B_D_BwE";
const DAILY_WELCOME_DONE_KEY = "nm_daily_welcome_done";
const DAILY_WELCOME_MODAL_SESSION_KEY = "nm_daily_welcome_modal_dismissed";

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function directionFromGuessToTarget(guessLat, guessLon, targetLat, targetLon) {
  const deltaLat = targetLat - guessLat;
  const deltaLon = targetLon - guessLon;
  const angle = (Math.atan2(deltaLat, deltaLon) * 180) / Math.PI;

  if (angle >= -22.5 && angle < 22.5) return "e";
  if (angle >= 22.5 && angle < 67.5) return "ne";
  if (angle >= 67.5 && angle < 112.5) return "n";
  if (angle >= 112.5 && angle < 157.5) return "nw";
  if (angle >= 157.5 || angle < -157.5) return "w";
  if (angle >= -157.5 && angle < -112.5) return "sw";
  if (angle >= -112.5 && angle < -67.5) return "s";
  return "se";
}

function normalizeDirection(direction) {
  const lower = (direction || "").trim().toLowerCase();
  if (["n", "ne", "e", "se", "s", "sw", "w", "nw"].includes(lower)) return lower;
  return "n";
}

function directionGlyph(direction) {
  const glyphMap = {
    n: "⬆",
    ne: "⬈",
    e: "➡",
    se: "⬊",
    s: "⬇",
    sw: "⬋",
    w: "⬅",
    nw: "⬉"
  };
  return glyphMap[normalizeDirection(direction)] || "⬆";
}

function summitEmojiForAttempts(attemptNumber) {
  if (attemptNumber <= 1) return "🎯";
  if (attemptNumber <= 5) return "🧗";
  if (attemptNumber <= 9) return "⛏️";
  return "😴";
}

function baseAttemptFeedbackMessage(distanceKm, summited) {
  if (summited) return "Summit achieved. Boots off, snacks out.";

  const ranges = [
    { maxKm: 1, msg: "Perfect line. You're basically standing on the summit cairn." },
    { maxKm: 2, msg: "Elite pinpointing. Ice-axe precision." },
    { maxKm: 3, msg: "Incredible read. That is guide-level navigation." },
    { maxKm: 5, msg: "Outstanding. Rope up, you're right there." },
    { maxKm: 8, msg: "Super sharp. The peak is within touching distance." },
    { maxKm: 12, msg: "Excellent placement. One small step to the top." },
    { maxKm: 18, msg: "Great call. You're climbing the right face." },
    { maxKm: 25, msg: "Strong move. Summit ridge is clearly in view." },
    { maxKm: 35, msg: "Very good. You chose the right mountain system." },
    { maxKm: 50, msg: "Solid effort. Keep that bearing and tighten up." },
    { maxKm: 70, msg: "Good trekking. You're on a promising line." },
    { maxKm: 100, msg: "Nice route-finding. A little more precision." },
    { maxKm: 140, msg: "Decent altitude awareness. Dial the map in." },
    { maxKm: 200, msg: "Not bad. You're in the broader summit zone." },
    { maxKm: 280, msg: "Reasonable guess. Refine your contour read." },
    { maxKm: 400, msg: "Mid-mountain energy. Keep adjusting." },
    { maxKm: 560, msg: "You found the region. Now find the peak." },
    { maxKm: 800, msg: "The trail is warm, not hot." },
    { maxKm: 1100, msg: "You're hiking in the right hemisphere vibe." },
    { maxKm: 1500, msg: "Big mountain country, wrong exact summit." },
    { maxKm: 2100, msg: "Ambitious line choice. Needs sharper bearings." },
    { maxKm: 3000, msg: "You're on expedition mode now." },
    { maxKm: 4200, msg: "This is less summit push, more scenic traverse." },
    { maxKm: 6000, msg: "You packed for a trek, got a road trip." },
    { maxKm: 8500, msg: "That guess needs a helicopter transfer." },
    { maxKm: 11000, msg: "Different range, strong confidence." },
    { maxKm: 14000, msg: "Impressive commitment to the wrong mountain." },
    { maxKm: 17000, msg: "You're hiking by vibes alone right now." },
    { maxKm: 19500, msg: "Basecamp called. They can't find you." },
    { maxKm: Number.POSITIVE_INFINITY, msg: "Legendary detour. The summit sent a postcard." }
  ];

  for (const range of ranges) {
    if (distanceKm <= range.maxKm) return range.msg;
  }
  return ranges[ranges.length - 1].msg;
}

function formatChallengeDate(isoDate) {
  if (!isoDate) return "Daily";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function formatShareDate(isoDate) {
  if (!isoDate) return "Daily";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function createRandomFirework(idSeed) {
  return {
    id: `${idSeed}-${Math.random().toString(36).slice(2, 8)}`,
    left: 8 + Math.random() * 84,
    top: 10 + Math.random() * 78,
    delayMs: 0
  };
}

export default function DailyPlay({ testDateId = "" }) {
  const [challenge, setChallenge] = useState(null);
  const [challengeDate, setChallengeDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [guess, setGuess] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [shareStatus, setShareStatus] = useState("");
  const [showFinalScoreModal, setShowFinalScoreModal] = useState(false);
  const [fireworksBursts, setFireworksBursts] = useState([]);
  const [dismissedWelcomeModal, setDismissedWelcomeModal] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.sessionStorage.getItem(DAILY_WELCOME_MODAL_SESSION_KEY) === "1";
  });

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError("");
      const trimmed = (testDateId || "").trim();
      const q = trimmed ? `?date=${encodeURIComponent(trimmed)}` : "";
      try {
        const res = await fetch(`/api/game/daily${q}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load challenge");
        if (!cancelled) {
          setChallenge(data.challenge);
          setChallengeDate(data.date || "");
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [testDateId]);

  const currentRound = challenge?.rounds?.[0] || null;
  const storageKey = challengeDate ? `mountain-guessr:daily:${challengeDate}` : "";

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      setAttempts(Array.isArray(saved.attempts) ? saved.attempts : []);
      setGuess(saved.guess || null);
    } catch {
      // ignore bad storage
    }
  }, [storageKey]);

  const persist = (next) => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const latest = attempts[attempts.length - 1] || null;
  const mapGuess = guess || latest?.guess || null;
  const summitAttempt = attempts.find((a) => a.distanceKm <= SUMMIT_DISTANCE_KM) || null;
  const summited = Boolean(summitAttempt);
  const finished = summited;
  const canSubmitAttempt = !summited;
  const closestAttempt =
    attempts.length > 0
      ? attempts.reduce((closest, a) => (a.distanceKm < closest.distanceKm ? a : closest), attempts[0])
      : null;

  const showFireworks =
    finished &&
    showFinalScoreModal &&
    summited &&
    (summitAttempt?.tryNumber || Number.POSITIVE_INFINITY) <= 5;
  const showWelcomeModal = !loading && !error && attempts.length === 0 && !dismissedWelcomeModal;

  useEffect(() => {
    if (finished) setShowFinalScoreModal(true);
  }, [finished]);

  useEffect(() => {
    if (!showFinalScoreModal) {
      setFireworksBursts([]);
      return;
    }
    let intervalId;
    let timeoutId;
    if (showFireworks) {
      setFireworksBursts([createRandomFirework(Date.now())]);
      intervalId = window.setInterval(() => {
        const next = createRandomFirework(Date.now());
        setFireworksBursts((prev) => [...prev, next]);
        window.setTimeout(() => {
          setFireworksBursts((prev) => prev.filter((b) => b.id !== next.id));
        }, 1800);
      }, 260);
      timeoutId = window.setTimeout(() => setFireworksBursts([]), 3600);
    }
    return () => {
      if (intervalId) window.clearInterval(intervalId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [showFinalScoreModal, showFireworks]);

  const dismissWelcomeModal = () => {
    setDismissedWelcomeModal(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DAILY_WELCOME_DONE_KEY, "1");
      window.sessionStorage.setItem(DAILY_WELCOME_MODAL_SESSION_KEY, "1");
    }
  };

  useEffect(() => {
    if (!showWelcomeModal || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showWelcomeModal]);

  useEffect(() => {
    if (!showWelcomeModal) return;
    const onKey = (e) => {
      if (e.key === "Escape") dismissWelcomeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showWelcomeModal]);

  const submitAttempt = () => {
    if (!guess || !currentRound || !canSubmitAttempt) return;
    const attemptNumber = attempts.length + 1;
    const distanceKm = haversineKm(guess.lat, guess.lon, currentRound.latitude, currentRound.longitude);
    const direction = directionFromGuessToTarget(
      guess.lat,
      guess.lon,
      currentRound.latitude,
      currentRound.longitude
    );
    const nextAttempts = [...attempts, { tryNumber: attemptNumber, guess, distanceKm, direction }];
    setAttempts(nextAttempts);
    setGuess(null);
    persist({ attempts: nextAttempts, guess: null });
  };

  const shareSummary = useMemo(() => {
    if (!finished || !closestAttempt) return "";
    const prettyDate = formatShareDate(challengeDate);
    if (summited && summitAttempt) {
      const attemptLabel = summitAttempt.tryNumber === 1 ? "attempt" : "attempts";
      const emoji = summitEmojiForAttempts(summitAttempt.tryNumber);
      return `nearestmountain.com/play\n${prettyDate}: SUMMITED in ${summitAttempt.tryNumber} ${attemptLabel} ${emoji}`;
    }
    return `nearestmountain.com/play\n${prettyDate}: Not summited\nclosest attempt: ${closestAttempt.distanceKm.toFixed(1)}km ${directionGlyph(closestAttempt.direction)}`;
  }, [finished, challengeDate, summited, summitAttempt, closestAttempt]);
  const feedbackMessage = (() => {
    if (!latest || typeof latest.distanceKm !== "number") return "";

    const latestBase = baseAttemptFeedbackMessage(latest.distanceKm, summited);
    if (attempts.length < 2 || summited) return latestBase;

    const prev = attempts[attempts.length - 2];
    if (!prev || typeof prev.distanceKm !== "number") return latestBase;
    const prevBase = baseAttemptFeedbackMessage(prev.distanceKm, false);

    if (latestBase !== prevBase) return latestBase;

    const alternates = [
      "Keep climbing.",
      "Eyes on the ridgeline."
    ];
    return alternates[attempts.length % 2];
  })();

  const onShare = async () => {
    if (!shareSummary) return;
    try {
      await navigator.clipboard.writeText(shareSummary);
      setShareStatus("Copied to clipboard");
    } catch {
      setShareStatus("Could not copy automatically.");
    }
  };

  if (loading) return <main className="game-shell game-play game-play--state"><div className="game-loading" aria-live="polite" aria-busy="true"><div className="game-loading__spinner" /><p className="game-loading__text">Loading daily mountain…</p></div></main>;
  if (error) return <main className="game-shell game-play game-play--state"><div className="game-state-panel game-animate-in"><p className="game-state-panel__error">{error}</p></div></main>;
  if (!currentRound) return <main className="game-shell game-play game-play--state"><div className="game-state-panel game-animate-in"><p>No daily mountain configured yet.</p></div></main>;

  return (
    <main className="game-shell game-play game-animate-in">
      <header className="game-hud" role="banner">
        <div className="game-hud__brand"><span className="game-hud__mark" aria-hidden>⛰</span><div className="game-hud__brand-text"><h1 className="game-hud__title">Summit Attempt</h1><p className="game-hud__date">{formatChallengeDate(challengeDate)}</p>{testDateId ? <p className="game-hud__preview">Preview (gamemaster test link)</p> : null}</div></div>
        <div className="game-hud__stats"><p className="game-hud__scoreline"><span className="game-hud__label">Attempts</span><span className="game-hud__scoreval">{attempts.length}</span></p></div>
      </header>

      {showWelcomeModal ? (
        <div className="game-welcome-backdrop" onClick={dismissWelcomeModal}><div className="game-welcome-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"><div><h2 className="game-welcome-title">Summit Attempt Daily Challenge</h2><p className="game-welcome-lead">You have unlimited attempts to pinpoint this mountain.</p><p className="game-welcome-lead">After each attempt, you will see both distance and direction.</p><p className="game-welcome-lead">You summit when a guess is within {SUMMIT_DISTANCE_KM} km of the true peak. Get there in as few attempts as you can.</p></div><div className="game-welcome-actions"><button type="button" className="game-btn game-btn--primary game-btn--big" onClick={dismissWelcomeModal} autoFocus>Start</button></div></div></div>
      ) : null}

      {finished && showFinalScoreModal ? (
        <div className="game-final-modal-backdrop" onClick={() => setShowFinalScoreModal(false)}>
          {showFireworks ? <div className="game-fireworks-layer" aria-hidden>{fireworksBursts.map((burst) => <span key={burst.id} className="game-firework" style={{ left: `${burst.left}%`, top: `${burst.top}%`, animationDelay: `${burst.delayMs}ms` }} />)}</div> : null}
          <div className="game-final-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <p className="game-final-modal__eyebrow">Daily complete</p>
            <h2 className="game-final-modal__title">{summited ? "You've summited today's mountain!" : "Challenge complete"}</h2>
            <p className="game-final-modal__place">{currentRound.title}</p>
            <a className="game-btn game-btn--secondary game-map-link game-map-link--modal" href={`https://www.google.com/maps?q=${currentRound.latitude},${currentRound.longitude}`} target="_blank" rel="noopener noreferrer">📍 Open in Google Maps</a>
            <p className="game-final-modal__distance">Closest attempt: {closestAttempt?.distanceKm?.toFixed(1) || "0.0"} km off</p>
            {summited && summitAttempt ? <p className="game-final-modal__distance">It took you {summitAttempt.tryNumber} {summitAttempt.tryNumber === 1 ? "attempt" : "attempts"} to summit.</p> : null}
            <div className="game-final-modal__actions"><button type="button" className="game-btn game-btn--primary" onClick={onShare}>Share</button><button type="button" className="game-btn game-btn--secondary" onClick={() => setShowFinalScoreModal(false)}>Close</button></div>
            {shareStatus ? <p className="game-share-status">{shareStatus}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="game-grid game-grid--play">
        <section className="game-photo game-card game-card--photo">
          {currentRound.imageUrl ? <img src={currentRound.imageUrl} alt={currentRound.title || "Daily mountain"} /> : <div className="game-photo-empty"><p>No image provided for this mountain.</p></div>}
          {finished ? <div className="game-photo-title-row"><div><h2>{currentRound.title}</h2><p className="game-ethics-note">Inspired to visit? Remember to <a href={LEAVE_NO_TRACE_URL} target="_blank" rel="noopener noreferrer" className="game-ethics-link">leave no trace</a>.</p></div><a className="game-btn game-btn--secondary game-map-link" href={`https://www.google.com/maps?q=${currentRound.latitude},${currentRound.longitude}`} target="_blank" rel="noopener noreferrer">📍 Open in Google Maps</a></div> : null}
          {currentRound.description ? <p>{currentRound.description}</p> : null}
          <div className="game-controls">
            {!finished ? <p>Attempt {attempts.length + 1}</p> : null}
            {latest ? <p className="game-distance-readout">Last attempt<span className="game-distance-value">{latest.distanceKm.toFixed(1)} km<img src={`/arrows/${normalizeDirection(latest.direction)}.svg?v=2`} alt={normalizeDirection(latest.direction)} style={{ display: "inline-block", width: "0.6em", height: "0.6em", marginLeft: "0.2em", verticalAlign: "-0.08em", background: "transparent", boxShadow: "none", filter: "brightness(0) invert(1)" }} /></span></p> : <p>Each attempt shows distance and direction. A summit is any guess within {SUMMIT_DISTANCE_KM} km of the peak.</p>}
          </div>
        </section>

        <section className="game-map-section game-card game-card--map">
          <InteractiveGuessMap guess={mapGuess} submitted={summited} challenge={currentRound} canPlaceGuess={canSubmitAttempt} onGuessPlaced={(nextGuess) => setGuess(nextGuess)} />
          <div className="game-controls">
            {guess ? <p>Attempt: {guess.lat}, {guess.lon}</p> : <p>{finished ? "Daily complete." : "Click the map to place your attempt."}</p>}
            <button type="button" className="game-btn game-btn--primary game-btn--lock" disabled={!guess || !canSubmitAttempt} onClick={submitAttempt}>{finished ? "Summited" : "Push for the Summit"}</button>
            {feedbackMessage ? <p style={{ marginTop: 8, marginBottom: 0, color: "#94a3b8", fontSize: "0.9rem", fontStyle: "italic" }}>{feedbackMessage}</p> : null}
          </div>
        </section>
      </div>

      {attempts.length ? (
        <section className="game-result game-card game-card--summary">
          <h3 className="game-card__head">Attempt history</h3>
          <ul className="game-breakdown-list" aria-label="Attempt results">
            {attempts.map((item) => (
              <li key={item.tryNumber} className="game-breakdown-list__row">
                <span className="game-breakdown-list__round">A{item.tryNumber}</span>
                <span className="game-breakdown-list__name">{item.distanceKm.toFixed(1)} km away</span>
                <span className="game-breakdown-list__pts"><img src={`/arrows/${normalizeDirection(item.direction)}.svg?v=2`} alt={normalizeDirection(item.direction)} style={{ display: "inline-block", width: "0.6em", height: "0.6em", verticalAlign: "-0.08em", background: "transparent", boxShadow: "none", filter: "brightness(0) invert(1)" }} /></span>
              </li>
            ))}
          </ul>
          {finished ? <div className="game-final-total-row"><p className="game-final-total-line"><strong>Closest attempt</strong> {closestAttempt?.distanceKm?.toFixed(1) || "0.0"} km</p><button type="button" className="game-btn game-btn--primary" onClick={onShare}>Share</button></div> : null}
          {shareStatus ? <p className="game-share-status">{shareStatus}</p> : null}
        </section>
      ) : null}
    </main>
  );
}
