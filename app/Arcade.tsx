"use client";

import { useEffect, useState } from "react";

type Profile = { displayName: string; balance: number; demo: boolean };
type GameResult = Profile & { roll: number; won: boolean; delta: number };

export function Arcade() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [choice, setChoice] = useState<"odd" | "even">("even");
  const [result, setResult] = useState<GameResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetch("/api/account")
      .then((response) => response.json())
      .then(setProfile)
      .finally(() => setLoading(false));
  }, []);

  async function play() {
    setPlaying(true);
    const response = await fetch("/api/game", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ choice }),
    });
    const next = (await response.json()) as GameResult;
    setResult(next);
    setProfile(next);
    setPlaying(false);
  }

  return (
    <main>
      <nav className="nav">
        <a className="brand" href="#top" aria-label="BFNRY home">
          BFNRY<span>.</span>
        </a>
        <div className="account-pill">
          <span className="coin" aria-hidden="true">B</span>
          <strong>{loading ? "—" : profile?.balance ?? 0}</strong>
          <span className="account-name">{profile?.displayName ?? "loading player"}</span>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="eyebrow"><i /> PRIVATE PLAYGROUND · V0.1</div>
        <h1>A tiny internet arcade<br />for <em>the group chat.</em></h1>
        <p>Play questionable games, earn extremely serious Bux, and claim bragging rights that have no cash value whatsoever.</p>
        <a className="primary" href="#play">Play the first game <span>↓</span></a>
        <div className="orb orb-one" /><div className="orb orb-two" />
      </section>

      <section className="game-wrap" id="play">
        <div className="section-heading">
          <div><span>GAME 001</span><h2>Odd or Even</h2></div>
          <p>Pick a side. The server rolls 1–100. A win earns 10 Bux; a loss costs 10.</p>
        </div>
        <div className="game-card">
          <div className="choice-row" role="group" aria-label="Choose odd or even">
            <button className={choice === "odd" ? "selected" : ""} onClick={() => setChoice("odd")}><small>01</small> ODD</button>
            <button className={choice === "even" ? "selected" : ""} onClick={() => setChoice("even")}><small>02</small> EVEN</button>
          </div>
          <div className={`result ${result ? (result.won ? "win" : "loss") : ""}`} aria-live="polite">
            {result ? <><span className="roll">{result.roll}</span><strong>{result.won ? "YOU CALLED IT" : "NOT THIS TIME"}</strong><p>{result.delta > 0 ? "+" : ""}{result.delta} Bux · New balance: {result.balance}</p></> : <><span className="roll">?</span><strong>THE NUMBER AWAITS</strong><p>Each roll costs courage and possibly 10 Bux.</p></>}
          </div>
          <button className="play" onClick={play} disabled={playing || !profile || profile.balance < 10}>{playing ? "ROLLING…" : `ROLL ${choice.toUpperCase()}`}</button>
        </div>
      </section>

      <section className="roadmap">
        <div><span>NOW</span><strong>Odd or Even</strong><p>Server-side rolls and balances.</p></div>
        <div><span>NEXT</span><strong>Friend leaderboard</strong><p>See who is Bux-rich.</p></div>
        <div><span>LATER</span><strong>More weird games</strong><p>Built one bad idea at a time.</p></div>
      </section>

      {profile?.demo && <div className="demo-note">LOCAL DEMO ACCOUNT · Production accounts use sign-in</div>}
      <footer><span>BFNRY.COM</span><p>Built for fun. Bux are fictional and cannot be purchased or redeemed.</p></footer>
    </main>
  );
}
