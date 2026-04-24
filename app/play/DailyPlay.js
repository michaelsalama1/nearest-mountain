"use client";

import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";

const InteractiveGuessMap = dynamic(() => import("./InteractiveGuessMap"), {
  ssr: false
});

const MAX_TRIES = 5;
const BASE_MAX = 1000;
const MIN_BASE = 800;
const BASE_DROP_PER_TRY = 50;
const SCORE_DISTANCE_SCALE_KM = 2000;
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

function baseScoreForTry(tryNumber) {
  return Math.max(MIN_BASE, BASE_MAX - (tryNumber - 1) * BASE_DROP_PER_TRY);
}

function scoreForAttempt(tryNumber, distanceKm) {
  const base = baseScoreForTry(tryNumber);
  const safeDistanceKm = Math.max(0, distanceKm);
  const score = base * Math.exp(-safeDistanceKm / SCORE_DISTANCE_SCALE_KM);
  return Math.max(1, Math.round(score));
}

function formatChallengeDate(isoDate) {
  if (!isoDate) return "Daily";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function emojiForScore(score) {
  if (score >= 950) return "🎯";
  if (score >= 900) return "🏔️";
  if (score >= 800) return "🌄";
  if (score >= 700) return "⛰️";
  return "🔭";
}

function scoreTierClass(score) {
  if (score < 200) return "game-score-tier--bad";
  if (score < 500) return "game-score-tier--ok";
  if (score < 700) return "game-score-tier--good";
  return "game-score-tier--great";
}

function createRandomFirework(idSeed) {
  return {
    id: `${idSeed}-${Math.random().toString(36).slice(2, 8)}`,
    left: 8 + Math.random() * 84,
    top: 10 + Math.random() * 78,
    delayMs: 0
  };
}

export default function DailyPlay() {
  const [challenge, setChallenge] = useState(null);
  const [challengeDate, setChallengeDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [guess, setGuess] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [lockedAtTry, setLockedAtTry] = useState(null);
  const [shareStatus, setShareStatus] = useState("");
  const [showFinalScoreModal, setShowFinalScoreModal] = useState(false);
  const [showFinalScoreNumber, setShowFinalScoreNumber] = useState(false);
  const [finalScoreFillPercent, setFinalScoreFillPercent] = useState(0);
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
      try {
        const res = await fetch("/api/game/daily", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load challenge");
        if (cancelled) return;
        setChallenge(data.challenge);
        setChallengeDate(data.date || "");
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
  }, []);

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
      setLockedAtTry(
        Number.isInteger(saved.lockedAtTry) && saved.lockedAtTry > 0
          ? saved.lockedAtTry
          : null
      );
    } catch {
      // ignore bad localStorage
    }
  }, [storageKey]);

  const persist = (next) => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const latest = attempts[attempts.length - 1] || null;
  const mapGuess = guess || latest?.guess || null;
  const forcedLockTry = attempts.length >= MAX_TRIES ? MAX_TRIES : null;
  const resolvedLockTry = lockedAtTry || forcedLockTry;
  const finished = Boolean(resolvedLockTry);
  const triesLeft = Math.max(0, MAX_TRIES - attempts.length);

  const finalAttempt = resolvedLockTry ? attempts[resolvedLockTry - 1] || null : null;
  const finalScore = finalAttempt?.points || 0;
  const canSubmitTry = !finished;
  const currentTryMax = baseScoreForTry(attempts.length + 1);
  const showFireworks = finished && showFinalScoreModal && finalScore > 950;
  const finalScoreTierClass = scoreTierClass(finalScore);
  const showWelcomeModal =
    !loading &&
    !error &&
    attempts.length === 0 &&
    !dismissedWelcomeModal;

  useEffect(() => {
    if (finished) setShowFinalScoreModal(true);
  }, [finished]);

  useEffect(() => {
    if (!showFinalScoreModal) {
      setShowFinalScoreNumber(false);
      setFinalScoreFillPercent(0);
      setFireworksBursts([]);
      return;
    }
    const targetFill = Math.max(0, Math.min(100, (finalScore / 1000) * 100));
    let fireworksInterval;
    let pruneTimeout;
    if (showFireworks) {
      setFireworksBursts([createRandomFirework(Date.now())]);
      fireworksInterval = window.setInterval(() => {
        const now = Date.now();
        const nextBurst = createRandomFirework(now);
        setFireworksBursts((prev) => [...prev, nextBurst]);
        window.setTimeout(() => {
          setFireworksBursts((prev) => prev.filter((burst) => burst.id !== nextBurst.id));
        }, 1800);
      }, 260);
      pruneTimeout = window.setTimeout(() => {
        setFireworksBursts([]);
      }, 3600);
    }
    const startTimeout = window.setTimeout(() => setFinalScoreFillPercent(targetFill), 40);
    const revealTimeout = window.setTimeout(() => setShowFinalScoreNumber(true), 2000);
    return () => {
      window.clearTimeout(startTimeout);
      window.clearTimeout(revealTimeout);
      if (fireworksInterval) window.clearInterval(fireworksInterval);
      if (pruneTimeout) window.clearTimeout(pruneTimeout);
    };
  }, [showFinalScoreModal, finalScore, showFireworks]);

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
    if (!guess || !currentRound || !canSubmitTry) return;
    const tryNumber = attempts.length + 1;
    const distanceKm = haversineKm(
      guess.lat,
      guess.lon,
      currentRound.latitude,
      currentRound.longitude
    );
    const points = scoreForAttempt(tryNumber, distanceKm);
    const base = baseScoreForTry(tryNumber);
    const distancePenalty = Math.max(0, base - points);
    const nextAttempts = [
      ...attempts,
      {
        tryNumber,
        guess,
        distanceKm,
        points,
        base,
        distancePenalty
      }
    ];
    setAttempts(nextAttempts);
    const hitMaxTries = nextAttempts.length >= MAX_TRIES;
    const nextTryNumber = tryNumber + 1;
    const nextTryMax = nextTryNumber <= MAX_TRIES ? baseScoreForTry(nextTryNumber) : 0;
    const autoLock = !hitMaxTries && nextTryMax < points;
    const nextLockedAtTry = hitMaxTries || autoLock ? tryNumber : lockedAtTry;
    setLockedAtTry(nextLockedAtTry);
    setGuess(null);
    persist({
      attempts: nextAttempts,
      guess: null,
      lockedAtTry: nextLockedAtTry
    });
  };

  const lockInScore = () => {
    if (!latest || finished) return;
    const chosenTry = latest.tryNumber;
    setLockedAtTry(chosenTry);
    persist({
      attempts,
      guess: null,
      lockedAtTry: chosenTry
    });
  };

  const shareSummary = useMemo(() => {
    if (!finished || !currentRound || !finalAttempt) return "";
    const emoji = emojiForScore(finalScore);
    return `nearestmountain.com/play\nFinal score: ${finalScore}/1000 ${emoji}`;
  }, [finished, currentRound, finalAttempt, finalScore]);

  const onShare = async () => {
    if (!shareSummary) return;
    try {
      await navigator.clipboard.writeText(shareSummary);
      setShareStatus("Copied to clipboard");
    } catch {
      setShareStatus("Could not copy automatically.");
    }
  };

  if (loading) {
    return (
      <main className="game-shell game-play game-play--state">
        <div className="game-loading" aria-live="polite" aria-busy="true">
          <div className="game-loading__spinner" />
          <p className="game-loading__text">Loading daily mountain…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="game-shell game-play game-play--state">
        <div className="game-state-panel game-animate-in">
          <p className="game-state-panel__error">{error}</p>
        </div>
      </main>
    );
  }

  if (!currentRound) {
    return (
      <main className="game-shell game-play game-play--state">
        <div className="game-state-panel game-animate-in">
          <p>No daily mountain configured yet.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="game-shell game-play game-animate-in">
      <header className="game-hud" role="banner">
        <div className="game-hud__brand">
          <span className="game-hud__mark" aria-hidden>⛰</span>
          <div className="game-hud__brand-text">
            <h1 className="game-hud__title">Nearest Mountain</h1>
            <p className="game-hud__date">{formatChallengeDate(challengeDate)}</p>
          </div>
        </div>

        <div className="game-round-track" role="list" aria-label="Tries used">
          {Array.from({ length: MAX_TRIES }, (_, p) => {
            const done = p < attempts.length;
            const current = !finished && p === attempts.length;
            return (
              <span
                key={p}
                className={[
                  "game-round-dot",
                  done && "game-round-dot--done",
                  current && "game-round-dot--current"
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={`Try ${p + 1}`}
                role="listitem"
              />
            );
          })}
        </div>

        <div className="game-hud__stats">
          {finished ? <p className="game-hud__badge">Locked in</p> : null}
          <p className="game-hud__scoreline">
            <span className="game-hud__label">Score</span>
            <span className="game-hud__scoreval">
              {finished ? finalScore : latest?.points || 0}
              <span className="game-hud__scoremax"> / 1000</span>
            </span>
          </p>
        </div>
      </header>

      {showWelcomeModal ? (
        <div className="game-welcome-backdrop" onClick={dismissWelcomeModal}>
          <div
            className="game-welcome-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-welcome-title"
            aria-describedby="daily-welcome-content"
          >
            <div id="daily-welcome-content">
              <h2 className="game-welcome-title" id="daily-welcome-title">
                Nearest Mountain Daily Challenge
              </h2>
              <p className="game-welcome-lead">
                You have 5 guesses to pinpoint this mountain!
              </p>
              <p className="game-welcome-lead">
                After each guess, you will know how far off you were, and you will have the option
                to guess again. But you lose 50 points for each additional guess.
              </p>
              <p className="game-welcome-lead">
                So after each guess, you can lock it in and share with friends, or guess again!
              </p>
            </div>
            <div className="game-welcome-actions">
              <button
                type="button"
                className="game-btn game-btn--primary game-btn--big"
                onClick={dismissWelcomeModal}
                autoFocus
              >
                Start
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {finished && showFinalScoreModal ? (
        <div
          className="game-final-modal-backdrop"
          onClick={() => setShowFinalScoreModal(false)}
        >
          {showFireworks ? (
            <div className="game-fireworks-layer" aria-hidden>
              {fireworksBursts.map((burst) => (
                <span
                  key={burst.id}
                  className="game-firework"
                  style={{
                    left: `${burst.left}%`,
                    top: `${burst.top}%`,
                    animationDelay: `${burst.delayMs}ms`
                  }}
                />
              ))}
            </div>
          ) : null}
          <div
            className="game-final-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-final-score-title"
          >
            <p className="game-final-modal__eyebrow">Daily complete</p>
            <h2 className="game-final-modal__title" id="daily-final-score-title">
              Final score
            </h2>
            <p className="game-final-modal__place">{currentRound.title}</p>
            <a
              className="game-btn game-btn--secondary game-map-link game-map-link--modal"
              href={`https://www.google.com/maps?q=${currentRound.latitude},${currentRound.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              📍 Open in Google Maps
            </a>
            <div className="game-final-modal__meter" aria-hidden>
              <div
                className={`game-final-modal__meter-fill ${finalScoreTierClass}`}
                style={{ width: `${finalScoreFillPercent}%` }}
              />
            </div>
            {showFinalScoreNumber ? (
              <p
                className={`game-final-modal__score game-final-modal__score--visible ${finalScoreTierClass}`}
              >
                {finalScore}
                <span className="game-final-modal__denominator"> / 1000</span>
              </p>
            ) : (
              <p className="game-final-modal__score game-final-modal__score--hidden" aria-hidden>
                0
                <span className="game-final-modal__denominator"> / 1000</span>
              </p>
            )}
            <p className="game-final-modal__distance">
              Final distance: {finalAttempt?.distanceKm?.toFixed(1) || "0.0"} km off
            </p>
            <div className="game-final-modal__actions">
              <button
                type="button"
                className="game-btn game-btn--primary"
                onClick={onShare}
              >
                Share
              </button>
              <button
                type="button"
                className="game-btn game-btn--secondary"
                onClick={() => setShowFinalScoreModal(false)}
              >
                Close
              </button>
            </div>
            {shareStatus ? <p className="game-share-status">{shareStatus}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="game-grid game-grid--play">
        <section className="game-photo game-card game-card--photo">
          {currentRound.imageUrl ? (
            <img src={currentRound.imageUrl} alt={currentRound.title || "Daily mountain"} />
          ) : (
            <div className="game-photo-empty">
              <p>No image provided for this mountain.</p>
            </div>
          )}
          {finished ? (
            <div className="game-photo-title-row">
              <div>
                <h2>{currentRound.title}</h2>
                <p className="game-ethics-note">
                  Inspired to visit? Remember to{" "}
                  <a
                    href={LEAVE_NO_TRACE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="game-ethics-link"
                  >
                    leave no trace
                  </a>
                  .
                </p>
              </div>
              <a
                className="game-btn game-btn--secondary game-map-link"
                href={`https://www.google.com/maps?q=${currentRound.latitude},${currentRound.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                📍 Open in Google Maps
              </a>
            </div>
          ) : null}
          {currentRound.description ? <p>{currentRound.description}</p> : null}
          <div className="game-controls">
            {!finished ? (
              <p>
                Try {Math.min(attempts.length + 1, MAX_TRIES)} of {MAX_TRIES} · {triesLeft} left
              </p>
            ) : null}
            {latest ? (
              <p className="game-distance-readout">
                Last guess
                <span className="game-distance-value">{latest.distanceKm.toFixed(1)} km away</span>
              </p>
            ) : (
              <p>
                After each guess, you&apos;ll know the distance away, but not the direction. You can
                choose to guess again or lock in your score and share with friends.
              </p>
            )}
            {latest && !finished ? (
              <p>
                Current lock score: {latest.points}/1000
              </p>
            ) : null}
          </div>
        </section>

        <section className="game-map-section game-card game-card--map">
          <InteractiveGuessMap
            guess={mapGuess}
            submitted={finished}
            challenge={currentRound}
            canPlaceGuess={canSubmitTry}
            onGuessPlaced={(nextGuess) => setGuess(nextGuess)}
          />
          <div className="game-controls">
            {guess ? (
              <p>
                Guess: {guess.lat}, {guess.lon}
              </p>
            ) : (
              <p>
                {finished
                  ? "Daily complete."
                  : "Click the map to place your guess."}
              </p>
            )}
            <button
              type="button"
              className="game-btn game-btn--primary game-btn--lock"
              disabled={!guess || !canSubmitTry}
              onClick={submitAttempt}
            >
              {finished
                ? "Complete"
                : `Submit guess (max ${currentTryMax})`}
            </button>
            {latest && !finished ? (
              <>
                <button
                  type="button"
                  className="game-btn game-btn--success game-btn--lock"
                  onClick={lockInScore}
                >
                  Lock in {latest?.points || 0}/1000
                </button>
              </>
            ) : null}
          </div>
        </section>
      </div>

      {attempts.length ? (
        <section className="game-result game-card game-card--summary">
          <h3 className="game-card__head">Try history</h3>
          <ul className="game-breakdown-list" aria-label="Try results">
            {attempts.map((item) => (
              <li key={item.tryNumber} className="game-breakdown-list__row">
                <span className="game-breakdown-list__round">T{item.tryNumber}</span>
                <span className="game-breakdown-list__name">
                  {item.distanceKm.toFixed(1)} km away
                </span>
                <span
                  className={`game-breakdown-list__pts ${scoreTierClass(item.points)}`}
                >
                  {item.points}
                  <span className="game-pts">pts</span>
                </span>
              </li>
            ))}
          </ul>
          {finished ? (
            <div className="game-final-total-row">
              <p className="game-final-total-line">
                <strong>Final score</strong> {finalScore}/1000
              </p>
              <button type="button" className="game-btn game-btn--primary" onClick={onShare}>
                Share
              </button>
            </div>
          ) : null}
          {shareStatus ? <p className="game-share-status">{shareStatus}</p> : null}
        </section>
      ) : null}
    </main>
  );
}
