"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

const InteractiveGuessMap = dynamic(() => import("./InteractiveGuessMap"), {
  ssr: false
});
const FinalResultsMap = dynamic(() => import("./FinalResultsMap"), {
  ssr: false
});

const ROUND_MULTIPLIERS = [1, 1, 2, 3, 3];
const ROUND_BASE_MAX = 100;
// Using a hint multiplies the round’s weight (1,1,2,3,3) by this factor.
const HINT_MULTIPLIER = 0.75;
// Total hint uses allowed per run (across all rounds), not one per round.
const MAX_HINTS = 2;
const ROUND_SUBMISSION_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSc2afp2tqxPG6So9R_O_whVR4XcUVmift-W3k5b-_f5nlANPQ/viewform?usp=preview";
const WELCOME_DONE_KEY = "nm_welcome_done";
const WELCOME_MODAL_SESSION_KEY = "nm_welcome_modal_dismissed";
// const TIP_JAR_URL = "https://buymeacoffee.com/nearestmountain";

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

function scoreFromDistance(distanceKm) {
  // Base round score is out of 100, then weighted by round multiplier.
  return Math.max(0, Math.round(ROUND_BASE_MAX - distanceKm * 0.04));
}

function formatChallengeDate(isoDate) {
  if (!isoDate) return "Daily";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function emojiForBaseScore(baseScore) {
  if (baseScore === 100) return "🎯";
  if (baseScore >= 95) return "🏔️";
  if (baseScore >= 90) return "🌄";
  if (baseScore >= 85) return "⛏️";
  if (baseScore >= 80) return "🌲";
  return "🔭";
}

export default function PlayPage() {
  const [challenge, setChallenge] = useState(null);
  const [challengeDate, setChallengeDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [guess, setGuess] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [roundIndex, setRoundIndex] = useState(0);
  const [roundResults, setRoundResults] = useState([]);
  const [shareStatus, setShareStatus] = useState("");
  const [alreadyPlayedToday, setAlreadyPlayedToday] = useState(false);
  const [hintsUsed, setHintsUsed] = useState([false, false, false, false, false]);
  const [isDemo, setIsDemo] = useState(false);
  const [dismissedWelcomeModal, setDismissedWelcomeModal] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.sessionStorage.getItem(WELCOME_MODAL_SESSION_KEY) === "1";
  });

  const dismissWelcomeModal = useCallback(() => {
    setDismissedWelcomeModal(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(WELCOME_MODAL_SESSION_KEY, "1");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRealDaily() {
      const res = await fetch("/api/game/daily", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load challenge");
      if (cancelled) return;
      setIsDemo(false);
      setChallenge(data.challenge);
      setChallengeDate(data.date || "");
    }

    async function init() {
      setLoading(true);
      setError("");
      try {
        const welcome =
          typeof window !== "undefined" && window.localStorage.getItem(WELCOME_DONE_KEY);
        if (welcome) {
          await loadRealDaily();
        } else {
          const res = await fetch("/api/game/daily?date=demo", { cache: "no-store" });
          const data = await res.json();
          if (res.ok) {
            if (cancelled) return;
            setIsDemo(true);
            setChallenge(data.challenge);
            setChallengeDate(data.date || "demo");
          } else {
            if (typeof window !== "undefined") {
              window.localStorage.setItem(WELCOME_DONE_KEY, "1");
            }
            await loadRealDaily();
          }
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
  }, []);

  useEffect(() => {
    if (!challengeDate || !challenge?.rounds?.length) return;

    const storageKey = `mountain-guessr:${challengeDate}`;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setRoundResults([]);
      setRoundIndex(0);
      setSubmitted(false);
      setGuess(null);
      setAlreadyPlayedToday(false);
      setHintsUsed(Array.from({ length: challenge.rounds.length }, () => false));
      return;
    }

    try {
      const saved = JSON.parse(raw);
      const savedResults = Array.isArray(saved.roundResults) ? saved.roundResults : [];
      setRoundResults(savedResults);
      setRoundIndex(Math.min(saved.roundIndex || 0, challenge.rounds.length - 1));
      setSubmitted(Boolean(saved.submitted));
      setGuess(saved.guess || null);

      const n = challenge.rounds.length;
      if (Array.isArray(saved.hintsUsed) && saved.hintsUsed.length === n) {
        setHintsUsed(saved.hintsUsed);
      } else {
        setHintsUsed(Array.from({ length: n }, () => false));
      }

      if (saved.finished) {
        setAlreadyPlayedToday(true);
        setSubmitted(false);
        setGuess(null);
      }
    } catch {
      // Ignore malformed local storage.
    }
  }, [challengeDate, challenge]);

  useEffect(() => {
    if (!isDemo || challengeDate !== "demo" || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("mountain-guessr:demo");
      if (!raw) return;
      const saved = JSON.parse(raw);
      const started =
        (typeof saved.roundIndex === "number" && saved.roundIndex > 0) ||
        (Array.isArray(saved.roundResults) && saved.roundResults.length > 0) ||
        Boolean(saved.finished);
      if (started) setDismissedWelcomeModal(true);
    } catch {
      // ignore
    }
  }, [isDemo, challengeDate]);

  const showWelcomeModal =
    isDemo && !loading && !error && !dismissedWelcomeModal;

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
  }, [showWelcomeModal, dismissWelcomeModal]);

  const goToRealDaily = async (round0Carry) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(WELCOME_DONE_KEY, "1");
    try {
      window.localStorage.removeItem("mountain-guessr:demo");
    } catch {
      // ignore
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/game/daily", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load challenge");
      const n = data.challenge?.rounds?.length || 0;
      const initialResults = round0Carry ? [round0Carry] : [];
      const key = `mountain-guessr:${data.date || ""}`;
      window.localStorage.setItem(
        key,
        JSON.stringify({
          roundIndex: 0,
          roundResults: initialResults,
          submitted: false,
          guess: null,
          finished: false,
          hintsUsed: Array.from({ length: n }, () => false)
        })
      );
      setIsDemo(false);
      setGuess(null);
      setSubmitted(false);
      setShareStatus("");
      setAlreadyPlayedToday(false);
      setChallenge(data.challenge);
      setChallengeDate(data.date || "");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const usedHintThisRound = Boolean(hintsUsed[roundIndex]);
  const result = useMemo(() => {
    if (!submitted || !guess || !challenge?.rounds?.[roundIndex]) return null;
    const currentRound = challenge.rounds[roundIndex];
    const multiplier = ROUND_MULTIPLIERS[roundIndex] || 1;
    const distanceKm = haversineKm(
      guess.lat,
      guess.lon,
      currentRound.latitude,
      currentRound.longitude
    );
    const baseScore = scoreFromDistance(distanceKm);
    const effectiveMultiplier = usedHintThisRound
      ? multiplier * HINT_MULTIPLIER
      : multiplier;
    return {
      distanceKm,
      baseScore,
      multiplier,
      effectiveMultiplier,
      usedHint: usedHintThisRound,
      score: Math.max(0, Math.round(baseScore * effectiveMultiplier))
    };
  }, [submitted, guess, challenge, roundIndex, usedHintThisRound]);

  const totalScore = useMemo(
    () => roundResults.reduce((sum, item) => sum + item.score, 0),
    [roundResults]
  );

  const totalScoreDaily = useMemo(
    () =>
      roundResults
        .filter((r) => r.round >= 1)
        .reduce((sum, item) => sum + item.score, 0),
    [roundResults]
  );

  const currentRound = challenge?.rounds?.[roundIndex] || null;
  const roundsCount = challenge?.rounds?.length || 0;
  const hasRound0 = roundResults.some((r) => r.round === 0);
  const nDailyRounds = roundsCount;
  const dailyRoundsInResults = roundResults.filter((r) => r.round >= 1);
  const gameFinished =
    nDailyRounds > 0 &&
    !isDemo &&
    (hasRound0
      ? dailyRoundsInResults.length === nDailyRounds
      : roundResults.length === nDailyRounds);
  const maxTotalScore = useMemo(
    () =>
      ROUND_MULTIPLIERS
        .slice(0, nDailyRounds)
        .reduce((s, x) => s + ROUND_BASE_MAX * x, 0),
    [nDailyRounds]
  );
  const totalTrackPips = nDailyRounds;

  const onMapClick = (nextGuess) => {
    if (alreadyPlayedToday) return;
    setGuess(nextGuess);
    setSubmitted(false);
  };

  const hintsUsedThisRun = hintsUsed.filter(Boolean).length;
  const noHintsLeft =
    !hintsUsed[roundIndex] && hintsUsedThisRun >= MAX_HINTS;

  const isRoundRecorded = isDemo
    ? roundsCount === 1
      ? roundResults.some((item) => item.round === 0)
      : roundResults.some((item) => item.round === roundIndex + 1)
    : roundResults.some((item) => item.round === roundIndex + 1);

  const saveProgress = (overrides = {}) => {
    if (!challengeDate) return;
    const storageKey = `mountain-guessr:${challengeDate}`;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        roundIndex,
        roundResults,
        submitted,
        guess,
        finished: false,
        hintsUsed,
        ...overrides
      })
    );
  };

  const onTakeHint = () => {
    if (!currentRound?.hint?.trim() || submitted || alreadyPlayedToday || isRoundRecorded) {
      return;
    }
    if (hintsUsed[roundIndex]) return;
    if (hintsUsedThisRun >= MAX_HINTS) return;
    const next = [...hintsUsed];
    next[roundIndex] = true;
    setHintsUsed(next);
    saveProgress({ hintsUsed: next });
  };

  const submitCurrentRound = () => {
    if (!guess || !result || !currentRound) return;

    const nextResult = {
      round: isDemo && roundsCount === 1 ? 0 : roundIndex + 1,
      title: currentRound.title || "",
      description: currentRound.description || "",
      baseScore: result.baseScore,
      multiplier: result.multiplier,
      effectiveMultiplier: result.effectiveMultiplier,
      usedHint: result.usedHint,
      score: result.score,
      distanceKm: result.distanceKm,
      guess,
      actual: {
        lat: currentRound.latitude,
        lon: currentRound.longitude
      }
    };

    setRoundResults((prev) => {
      const nextResults = [...prev, nextResult];
      saveProgress({
        roundIndex,
        roundResults: nextResults,
        submitted: false,
        guess: null,
        finished: isDemo
          ? false
          : nextResults.length === roundsCount
      });
      return nextResults;
    });
  };

  const pending =
    submitted && result && !isRoundRecorded ? result.score : 0;
  const displayTotalScore = isDemo
    ? totalScore + pending
    : totalScoreDaily + pending;

  const shareSummary = useMemo(() => {
    if (!gameFinished) return "";
    const prettyDate = formatChallengeDate(challengeDate);
    const shareRounds = roundResults.filter((r) => r.round >= 1);
    const roundsText = shareRounds
      .map((item) => {
        const multIndex = item.round - 1;
        const inferredMultiplier = ROUND_MULTIPLIERS[multIndex] || 1;
        const baseScore =
          typeof item.baseScore === "number"
            ? item.baseScore
            : Math.round(item.score / inferredMultiplier);
        const emoji = emojiForBaseScore(baseScore);
        return `${baseScore}${emoji}`;
      })
      .join(" ");
    return `nearestmountain.com/play ${prettyDate}\n${roundsText}\nFinal score: ${displayTotalScore}`;
  }, [gameFinished, roundResults, challengeDate, displayTotalScore]);

  const onShare = async () => {
    if (!shareSummary) return;
    try {
      await navigator.clipboard.writeText(shareSummary);
      setShareStatus("Copied results to clipboard.");
    } catch {
      setShareStatus("Could not copy automatically.");
    }
  };

  const moveToNextRound = () => {
    const isLastRound = roundIndex >= roundsCount - 1;
    if (isDemo && isLastRound) {
      return;
    }
    if (!isRoundRecorded) {
      submitCurrentRound();
    }
    const nextRoundIndex = isLastRound ? roundIndex : roundIndex + 1;
    if (!isLastRound) setRoundIndex(nextRoundIndex);
    setGuess(null);
    setSubmitted(false);
    saveProgress({
      roundIndex: nextRoundIndex,
      roundResults: isRoundRecorded
        ? roundResults
        : [
            ...roundResults,
            {
              round: roundIndex + 1,
              title: currentRound?.title || "",
              score: result?.score || 0,
              distanceKm: result?.distanceKm || 0
            }
          ],
      submitted: false,
      guess: null,
      finished: isLastRound
    });
    if (isLastRound) setAlreadyPlayedToday(true);
  };

  const leaveDemoToRealDaily = () => goToRealDaily(null);

  const completeDemoAndStartDaily = () => {
    if (!currentRound || !result) return;
    const r0 = {
      round: 0,
      title: currentRound.title || "",
      description: currentRound.description || "",
      baseScore: result.baseScore,
      multiplier: result.multiplier,
      effectiveMultiplier: result.effectiveMultiplier,
      usedHint: result.usedHint,
      score: result.score,
      distanceKm: result.distanceKm,
      guess,
      actual: {
        lat: currentRound.latitude,
        lon: currentRound.longitude
      }
    };
    goToRealDaily(r0);
  };

  if (loading) {
    return (
      <main className="game-shell game-play game-play--state">
        <div className="game-loading" aria-live="polite" aria-busy="true">
          <div className="game-loading__spinner" />
          <p className="game-loading__text">Loading your challenge…</p>
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

  if (!roundsCount) {
    return (
      <main className="game-shell game-play game-play--state">
        <div className="game-state-panel game-animate-in">
          <p>No rounds configured for this challenge yet.</p>
        </div>
      </main>
    );
  }

  const isLastRound = roundIndex >= roundsCount - 1;

  return (
    <main className="game-shell game-play game-animate-in">
      <header className="game-hud" role="banner">
        <div className="game-hud__brand">
          <span className="game-hud__mark" aria-hidden>⛰</span>
          <div className="game-hud__brand-text">
            <h1 className="game-hud__title">Nearest Mountain</h1>
            <p className="game-hud__date">
              {isDemo ? "Demo (practice) — not your real daily" : formatChallengeDate(challengeDate)}
            </p>
          </div>
        </div>

        {!isDemo ? (
        <div
          className="game-round-track"
          role="list"
          aria-label={`Rounds, ${roundIndex + 1} current`}
        >
          {Array.from({ length: totalTrackPips }, (_, p) => {
            const rNum = p + 1;
            const done = roundResults.some((r) => r.round === rNum);
            const current =
              !gameFinished &&
              !alreadyPlayedToday &&
              p === roundIndex;
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
                title={`Round ${rNum}`}
                role="listitem"
              />
            );
          })}
        </div>
        ) : null}

        <div className="game-hud__stats">
          {alreadyPlayedToday ? <p className="game-hud__badge">Done for today</p> : null}
          {gameFinished || alreadyPlayedToday ? (
            <p className="game-hud__scoreline">
              <span className="game-hud__label">Total</span>
              <span className="game-hud__scoreval">
                {displayTotalScore}
                <span className="game-hud__scoremax"> / {maxTotalScore}</span>
              </span>
            </p>
          ) : (
            <p className="game-hud__scoreline">
              {!isDemo ? (
                <span className="game-hud__label">R{roundIndex + 1}</span>
              ) : null}
              <span className="game-hud__scoreval">{displayTotalScore}</span>
            </p>
          )}
        </div>
      </header>

      {showWelcomeModal ? (
        <div
          className="game-welcome-backdrop"
          onClick={dismissWelcomeModal}
        >
          <div
            className="game-welcome-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-welcome-title"
            aria-describedby="game-welcome-content"
          >
            <div id="game-welcome-content">
              <h2 className="game-welcome-title" id="game-welcome-title">
                Welcome to Nearest Mountain!
              </h2>
              <p className="game-welcome-lead">
                Click the map, then lock your guess. Here is a demo run before jumping into the daily challenge.
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
              <button
                type="button"
                className="game-btn game-btn--secondary"
                onClick={leaveDemoToRealDaily}
              >
                Skip to today’s challenge
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!gameFinished && !alreadyPlayedToday ? <div className="game-grid game-grid--play">
        <section className="game-photo game-card game-card--photo">
          {currentRound.imageUrl ? (
            <img src={currentRound.imageUrl} alt={currentRound.title} />
          ) : (
            <div className="game-photo-empty">
              <p>No image provided for this round.</p>
            </div>
          )}
          {submitted ? (
            <div className="game-photo-title-row">
              <h2>{currentRound.title}</h2>
            </div>
          ) : null}
          {currentRound.description ? <p>{currentRound.description}</p> : null}

          {currentRound.hint?.trim() && !isRoundRecorded && !submitted && !alreadyPlayedToday ? (
            <div className="game-controls">
              <p>
                {hintsUsedThisRun} of {MAX_HINTS} hints used
              </p>
              {hintsUsed[roundIndex] ? (
                <p role="note">
                  <strong>Hint:</strong> {currentRound.hint}
                </p>
              ) : (
                <button
                  type="button"
                  className="game-btn game-btn--secondary game-btn--lock"
                  disabled={submitted || alreadyPlayedToday || noHintsLeft}
                  onClick={onTakeHint}
                >
                  {noHintsLeft
                    ? "No hints left"
                    : `Take hint (×${HINT_MULTIPLIER} mult.)`}
                </button>
              )}
            </div>
          ) : null}
        </section>

        <section className="game-map-section game-card game-card--map">
          <InteractiveGuessMap
            guess={guess}
            submitted={submitted}
            challenge={currentRound}
            canPlaceGuess={!submitted}
            onGuessPlaced={onMapClick}
          />

          <div className="game-controls">
            {guess ? (
              <p>
                Guess: {guess.lat}, {guess.lon}
              </p>
            ) : (
              <p>Click the map to place your guess.</p>
            )}

            <button
              type="button"
              className="game-btn game-btn--primary game-btn--lock"
              disabled={!guess || submitted}
              onClick={() => setSubmitted(true)}
            >
              {submitted ? "Guess locked" : "Lock guess"}
            </button>
          </div>
        </section>
      </div> : null}

      {result ? (
        <section className="game-result game-card game-card--result game-panel-pop">
          <h3 className="game-card__head">
            {isDemo && roundsCount === 1
              ? "Round 0 result"
              : `Round ${roundIndex + 1} result`}
          </h3>
          <p>Distance off: {result.distanceKm.toFixed(1)} km</p>
          <p>
            Score: {result.baseScore} (×
            {result.effectiveMultiplier % 1 === 0
              ? result.effectiveMultiplier
              : Number((result.effectiveMultiplier + 1e-10).toFixed(2))}
            )
          </p>
          <p>
            Actual location: {currentRound.latitude}, {currentRound.longitude}
          </p>
          <button
            type="button"
            className="game-btn game-btn--success game-btn--big"
            onClick={isDemo && isLastRound ? completeDemoAndStartDaily : moveToNextRound}
          >
            {isDemo && isLastRound
              ? "Start the daily challenge"
              : roundIndex < roundsCount - 1
                ? "Next round"
                : "Finish game"}
          </button>
        </section>
      ) : null}

      {gameFinished && roundResults.length ? (
        <section className="game-result game-card game-card--summary">
          <h3 className="game-card__head">Score summary</h3>
          <div className="game-final-total-row">
            <p className="game-final-total-line">
              <strong>Total</strong> {displayTotalScore}
              <span className="game-total-den"> / {maxTotalScore}</span>
            </p>
            <button
              type="button"
              className="game-btn game-btn--primary"
              onClick={onShare}
            >
              Share
            </button>
          </div>
          {shareStatus ? <p className="game-share-status">{shareStatus}</p> : null}
          <ul className="game-breakdown-list" aria-label="Points by round">
            {[...roundResults]
              .sort((a, b) => a.round - b.round)
              .map((item) => {
                const roundTitle =
                  (item.title && String(item.title).trim()) ||
                  (item.round > 0
                    ? (challenge?.rounds?.[item.round - 1]?.title || "")
                    : ""
                  ).trim();
                return (
                  <li key={item.round} className="game-breakdown-list__row">
                    <span className="game-breakdown-list__round">R{item.round}</span>
                    {roundTitle ? (
                      <span className="game-breakdown-list__name">{roundTitle}</span>
                    ) : (
                      <span className="game-breakdown-list__name game-breakdown-list__name--empty">
                        —
                      </span>
                    )}
                    <span className="game-breakdown-list__pts">
                      {item.score}
                      <span className="game-pts">pts</span>
                    </span>
                    <span className="game-breakdown-list__km">
                      {item.distanceKm.toFixed(1)} km
                      {item.usedHint ? " · hint" : null}
                    </span>
                  </li>
                );
              })}
          </ul>
          <h4 className="game-subhead">Map</h4>
          <FinalResultsMap roundResults={roundResults} rounds={challenge?.rounds || []} />
          <div className="game-end-actions">
            <a
              className="game-btn game-btn--secondary"
              href={ROUND_SUBMISSION_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Submit your own round!
            </a>
            {/*
            <a
              className="submit-guess-button"
              href={TIP_JAR_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Tip Jar
            </a>
            */}
          </div>
        </section>
      ) : null}
    </main>
  );
}
