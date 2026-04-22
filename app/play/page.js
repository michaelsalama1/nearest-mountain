"use client";

import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";

const InteractiveGuessMap = dynamic(() => import("./InteractiveGuessMap"), {
  ssr: false
});
const FinalResultsMap = dynamic(() => import("./FinalResultsMap"), {
  ssr: false
});

const ROUND_MULTIPLIERS = [1, 1, 2, 3, 3];
const ROUND_BASE_MAX = 100;
const ROUND_SUBMISSION_EMAIL = "me@michaelsalama.com";
const TIP_JAR_URL = "https://buymeacoffee.com/nearestmountain";

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

  useEffect(() => {
    async function loadDailyChallenge() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/game/daily", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load challenge");
        setChallenge(data.challenge);
        setChallengeDate(data.date || "");
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    loadDailyChallenge();
  }, []);

  useEffect(() => {
    if (!challengeDate || !challenge?.rounds?.length) return;

    const storageKey = `mountain-guessr:${challengeDate}`;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      const savedResults = Array.isArray(saved.roundResults) ? saved.roundResults : [];
      setRoundResults(savedResults);
      setRoundIndex(Math.min(saved.roundIndex || 0, challenge.rounds.length - 1));
      setSubmitted(Boolean(saved.submitted));
      setGuess(saved.guess || null);

      if (saved.finished) {
        setAlreadyPlayedToday(true);
        setSubmitted(false);
        setGuess(null);
      }
    } catch {
      // Ignore malformed local storage.
    }
  }, [challengeDate, challenge]);

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
    return {
      distanceKm,
      baseScore,
      multiplier,
      score: baseScore * multiplier
    };
  }, [submitted, guess, challenge, roundIndex]);

  const totalScore = useMemo(
    () => roundResults.reduce((sum, item) => sum + item.score, 0),
    [roundResults]
  );

  const currentRound = challenge?.rounds?.[roundIndex] || null;
  const roundsCount = challenge?.rounds?.length || 0;
  const gameFinished = roundsCount > 0 && roundResults.length === roundsCount;
  const maxTotalScore = ROUND_MULTIPLIERS
    .slice(0, roundsCount)
    .reduce((sum, multiplier) => sum + ROUND_BASE_MAX * multiplier, 0);

  const onMapClick = (nextGuess) => {
    if (alreadyPlayedToday) return;
    setGuess(nextGuess);
    setSubmitted(false);
  };

  const persistDailyState = (nextState) => {
    if (!challengeDate) return;
    const storageKey = `mountain-guessr:${challengeDate}`;
    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
  };

  const submitCurrentRound = () => {
    if (!guess || !result || !currentRound) return;

    const nextResult = {
      round: roundIndex + 1,
      title: currentRound.title || "",
      description: currentRound.description || "",
      baseScore: result.baseScore,
      multiplier: result.multiplier,
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
      persistDailyState({
        roundIndex,
        roundResults: nextResults,
        submitted: false,
        guess: null,
        finished: nextResults.length === roundsCount
      });
      return nextResults;
    });
  };

  const isRoundRecorded = roundResults.some((item) => item.round === roundIndex + 1);
  const displayTotalScore =
    totalScore + (submitted && result && !isRoundRecorded ? result.score : 0);

  const shareSummary = useMemo(() => {
    if (!gameFinished) return "";
    const prettyDate = formatChallengeDate(challengeDate);
    const roundsText = roundResults
      .map((item) => {
        const inferredMultiplier = ROUND_MULTIPLIERS[item.round - 1] || 1;
        const baseScore =
          typeof item.baseScore === "number"
            ? item.baseScore
            : Math.round(item.score / inferredMultiplier);
        const emoji = emojiForBaseScore(baseScore);
        return `${baseScore}${emoji}`;
      })
      .join(" ");
    return `nearestmountain.com/play ${prettyDate}\n${roundsText}\nFinal score: ${displayTotalScore}`;
  }, [gameFinished, roundResults, challengeDate, displayTotalScore, maxTotalScore]);

  const onShare = async () => {
    if (!shareSummary) return;
    try {
      await navigator.clipboard.writeText(shareSummary);
      setShareStatus("Copied results to clipboard.");
    } catch {
      setShareStatus("Could not copy automatically.");
    }
  };

  const submissionSubject = encodeURIComponent("Nearest Mountain round submission");
  const submissionBody = encodeURIComponent(
    `I'd like to submit a round idea for Nearest Mountain.\n\n` +
      `Mountain name/title:\n` +
      `Photo URL:\n` +
      `Latitude, Longitude:\n` +
      `Optional description:\n`
  );
  const submitRoundHref = `mailto:${ROUND_SUBMISSION_EMAIL}?subject=${submissionSubject}&body=${submissionBody}`;

  const moveToNextRound = () => {
    const isLastRound = roundIndex >= roundsCount - 1;
    if (!isRoundRecorded) {
      submitCurrentRound();
    }
    const nextRoundIndex = isLastRound ? roundIndex : roundIndex + 1;
    if (!isLastRound) setRoundIndex(nextRoundIndex);
    setGuess(null);
    setSubmitted(false);
    persistDailyState({
      roundIndex: nextRoundIndex,
      roundResults: isRoundRecorded ? roundResults : [...roundResults, { round: roundIndex + 1, score: result?.score || 0, distanceKm: result?.distanceKm || 0 }],
      submitted: false,
      guess: null,
      finished: isLastRound
    });
    if (isLastRound) setAlreadyPlayedToday(true);
  };

  if (loading) {
    return <main className="game-shell"><p>Loading daily mountain challenge...</p></main>;
  }

  if (error) {
    return <main className="game-shell"><p>{error}</p></main>;
  }

  if (!roundsCount) {
    return <main className="game-shell"><p>No rounds configured for this challenge yet.</p></main>;
  }

  return (
    <main className="game-shell">
      <div className="game-header">
        <h1>Nearest Mountain | Play</h1>
        <p>5 rounds. Look at the scene, click the map, and submit your guess.</p>
        {alreadyPlayedToday ? (
          <p><strong>Daily challenge already completed.</strong> Come back tomorrow.</p>
        ) : null}
        {gameFinished ? (
          <p><strong>Game complete.</strong> Final score: {displayTotalScore} / {maxTotalScore}</p>
        ) : (
          <p>Round {roundIndex + 1} of {roundsCount} • Total: {displayTotalScore}</p>
        )}
      </div>

      {!gameFinished && !alreadyPlayedToday ? <div className="game-grid">
        <section className="game-photo">
          {currentRound.imageUrl ? (
            <img src={currentRound.imageUrl} alt={currentRound.title} />
          ) : (
            <div className="game-photo-empty">
              <p>No image provided for this round.</p>
            </div>
          )}
          {submitted ? <h2>{currentRound.title}</h2> : <h2>???</h2>}
          {currentRound.description ? <p>{currentRound.description}</p> : null}
        </section>

        <section className="game-map-section">
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
              className="submit-guess-button"
              disabled={!guess || submitted}
              onClick={() => setSubmitted(true)}
            >
              {submitted ? "Guess Locked" : "Final Guess"}
            </button>
          </div>
        </section>
      </div> : null}

      {result ? (
        <section className="game-result">
          <h3>Round {roundIndex + 1} Result</h3>
          <p>Distance off: {result.distanceKm.toFixed(1)} km</p>
          <p>
            Score: {result.score} ({result.baseScore} x {result.multiplier})
          </p>
          <p>
            Actual location: {currentRound.latitude}, {currentRound.longitude}
          </p>
          <button className="big-next-round-button" onClick={moveToNextRound}>
            {roundIndex < roundsCount - 1 ? "Next Round" : "Finish Game"}
          </button>
        </section>
      ) : null}

      {roundResults.length ? (
        <section className="game-result">
          <h3>Final Score</h3>
          <p><strong>Total:</strong> {displayTotalScore}</p>
          {gameFinished ? (
            <>
              <h4>Round Breakdown</h4>
              {roundResults.map((item) => (
                <p key={item.round}>
                  Round {item.round}: {item.score} pts ({item.distanceKm.toFixed(1)} km)
                </p>
              ))}
              <h4>All Rounds Map</h4>
              <FinalResultsMap roundResults={roundResults} rounds={challenge?.rounds || []} />
              <button className="submit-guess-button" onClick={onShare}>
                Share
              </button>
              <a className="submit-guess-button" href={submitRoundHref}>
                Submit Your Own Round
              </a>
              <a
                className="submit-guess-button"
                href={TIP_JAR_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Tip Jar
              </a>
              {shareStatus ? <p>{shareStatus}</p> : null}
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
