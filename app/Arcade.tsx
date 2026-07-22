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

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

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
    <main>
      <h1>BFNRY</h1>

      <section aria-labelledby="account-heading">
        <h2 id="account-heading">Player</h2>
        {loading && <p>Loading player...</p>}
        {!loading && profile && (
          <p>{profile.displayName} — {profile.balance} Bux</p>
        )}
        {accountError && (
          <div role="alert">
            <p>Player error: {accountError}</p>
            <button type="button" onClick={() => void loadAccount()}>Try again</button>
          </div>
        )}
      </section>

      <section aria-labelledby="game-heading">
        <h2 id="game-heading">Odd or Even</h2>
        <p>Choose odd or even. A win earns 10 Bux and a loss costs 10 Bux.</p>

        <fieldset disabled={!profile || playing}>
          <legend>Your choice</legend>
          <label>
            <input
              type="radio"
              name="choice"
              value="odd"
              checked={choice === "odd"}
              onChange={() => setChoice("odd")}
            />
            Odd
          </label>
          <label>
            <input
              type="radio"
              name="choice"
              value="even"
              checked={choice === "even"}
              onChange={() => setChoice("even")}
            />
            Even
          </label>
        </fieldset>

        <button
          type="button"
          onClick={() => void play()}
          disabled={playing || !profile || profile.balance < 10}
        >
          {playing ? "Rolling..." : "Roll"}
        </button>

        {profile && profile.balance < 10 && <p>You need at least 10 Bux to play.</p>}
        {gameError && <p role="alert">Game error: {gameError}</p>}
        {result && (
          <div aria-live="polite">
            <h3>{result.won ? "You won" : "You lost"}</h3>
            <p>Roll: {result.roll}</p>
            <p>Change: {result.delta > 0 ? "+" : ""}{result.delta} Bux</p>
            <p>Balance: {result.balance} Bux</p>
          </div>
        )}
      </section>
    </main>
  );
}
