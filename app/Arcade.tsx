"use client";

import { useCallback, useEffect, useState } from "react";

type Profile = { displayName: string; balance: number; demo: boolean };
type GameResult = Profile & { roll: number; won: boolean; delta: number };

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body;
}

export function Arcade() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [choice, setChoice] = useState<"odd" | "even">("odd");
  const [result, setResult] = useState<GameResult | null>(null);
  const [accountError, setAccountError] = useState("");
  const [gameError, setGameError] = useState("");
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setAccountError("");
    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      setProfile(await readJson<Profile>(response));
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Could not load player");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAccount(); }, [loadAccount]);

  async function play() {
    setPlaying(true);
    setGameError("");
    try {
      const response = await fetch("/api/game", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      const next = await readJson<GameResult>(response);
      setResult(next);
      setProfile(next);
    } catch (error) {
      setGameError(error instanceof Error ? error.message : "Could not play game");
    } finally {
      setPlaying(false);
    }
  }

  return (
    <main className="site-shell">
      <div className="sky-bubble bubble-one" aria-hidden="true" />
      <div className="sky-bubble bubble-two" aria-hidden="true" />

      <header className="topbar">
        <a className="logo" href="#top" aria-label="BFNRY home">BFNRY</a>
        <p>the happy little internet arcade</p>
      </header>

      <section className="hero" id="top">
        <div className="sun" aria-hidden="true" />
        <div className="cloud cloud-one" aria-hidden="true" />
        <div className="cloud cloud-two" aria-hidden="true" />
        <div className="hero-copy">
          <p className="kicker">WELCOME TO YOUR FRESH CORNER OF THE WEB</p>
          <h1>Good vibes.<br />Tiny games.</h1>
          <p>Pick a side, roll the number, and grow your totally fictional fortune.</p>
          <a className="start-link" href="#play">Start playing</a>
        </div>
        <div className="landscape" aria-hidden="true">
          <div className="hill hill-back" />
          <div className="hill hill-front" />
          <div className="pond" />
        </div>
      </section>

      <section className="account-card glass-card" aria-labelledby="account-heading">
        <div className="avatar" aria-hidden="true">B</div>
        <div>
          <p className="eyebrow" id="account-heading">YOUR PLAYER</p>
          {loading && <p className="account-value">Loading player...</p>}
          {!loading && profile && <p className="account-value">{profile.displayName} <span>•</span> {profile.balance} Bux</p>}
        </div>
        {accountError && (
          <div className="error" role="alert">
            <p>Player error: {accountError}</p>
            <button type="button" onClick={() => void loadAccount()}>Try again</button>
          </div>
        )}
      </section>

      <section className="game-section" id="play" aria-labelledby="game-heading">
        <div className="section-intro">
          <p className="eyebrow">GAME 001</p>
          <h2 id="game-heading">Odd or Even?</h2>
          <p>Choose a side. Win 10 Bux if you call it right. Lose 10 if the number has other plans.</p>
        </div>

        <div className="game-console glass-card">
          <fieldset className="choice-fieldset" disabled={!profile || playing}>
            <legend>Choose your side</legend>
            <label className={choice === "odd" ? "choice active" : "choice"}>
              <input type="radio" name="choice" value="odd" checked={choice === "odd"} onChange={() => setChoice("odd")} />
              <span className="choice-number">01</span><strong>ODD</strong><small>1, 3, 5, 7...</small>
            </label>
            <label className={choice === "even" ? "choice active" : "choice"}>
              <input type="radio" name="choice" value="even" checked={choice === "even"} onChange={() => setChoice("even")} />
              <span className="choice-number">02</span><strong>EVEN</strong><small>2, 4, 6, 8...</small>
            </label>
          </fieldset>

          <div className={`result-panel ${result ? (result.won ? "result-win" : "result-loss") : ""}`} aria-live="polite">
            {result ? (
              <><p className="result-label">{result.won ? "YOU WON!" : "SO CLOSE!"}</p><strong className="roll-number">{result.roll}</strong><p>{result.delta > 0 ? "+" : ""}{result.delta} Bux</p><p>New balance: {result.balance} Bux</p></>
            ) : (
              <><p className="result-label">THE NUMBER AWAITS</p><strong className="roll-number">?</strong><p>Your result will appear here.</p></>
            )}
          </div>

          <button className="roll-button" type="button" onClick={() => void play()} disabled={playing || !profile || profile.balance < 10}>
            {playing ? "Rolling..." : `Roll ${choice}`}
          </button>
        </div>

        {profile && profile.balance < 10 && <p className="notice">You need at least 10 Bux to play.</p>}
        {gameError && <p className="error notice" role="alert">Game error: {gameError}</p>}
      </section>

      <footer><strong>BFNRY</strong><p>Bux are fictional. Fresh air is encouraged.</p></footer>
    </main>
  );
}
