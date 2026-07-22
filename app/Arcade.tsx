"use client";

import { useCallback, useEffect, useState } from "react";

type Profile = { displayName: string; balance: number; demo: boolean; bonusClaimed?: boolean };
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
  const [bonusState, setBonusState] = useState<"idle" | "claiming" | "claimed">("idle");
  const [bonusMessage, setBonusMessage] = useState("");

  const loadAccount = useCallback(async () => {
    setLoading(true); setAccountError("");
    try {
      const next = await readJson<Profile>(await fetch("/api/account", { cache: "no-store" }));
      setProfile(next);
      if (next.bonusClaimed) { setBonusState("claimed"); setBonusMessage("Collected"); }
    }
    catch (error) { setAccountError(error instanceof Error ? error.message : "Could not load player"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadAccount(); }, [loadAccount]);

  async function play() {
    setPlaying(true); setGameError("");
    try {
      const response = await fetch("/api/game", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ choice }) });
      const next = await readJson<GameResult>(response); setResult(next); setProfile(next);
    } catch (error) { setGameError(error instanceof Error ? error.message : "Could not play game"); }
    finally { setPlaying(false); }
  }

  async function claimBonus() {
    if (bonusState !== "idle") return;
    setBonusState("claiming"); setBonusMessage("");
    try {
      const next = await readJson<Profile & { awarded: boolean }>(await fetch("/api/bonus", { method: "POST" }));
      setProfile(next); setBonusState("claimed");
      setBonusMessage(next.awarded ? "+30 Suds" : "Already collected");
    } catch {
      setBonusState("idle"); setBonusMessage("Bubble slipped away");
    }
  }

  return (
    <main className="site-shell">
      <div className="ambient" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <button className={`bonus-bubble ${bonusState}`} type="button" onClick={() => void claimBonus()} disabled={bonusState !== "idle"} aria-label="Collect 30 bonus Suds"><span>{bonusState === "claiming" ? "…" : bonusState === "claimed" ? "✓" : "+30"}</span><small>{bonusMessage || "Suds"}</small></button>

      <header className="nav-shell">
        <a className="brand" href="#top" aria-label="BFNRY home"><span className="brand-mark"><b /></span><span><strong>BFNRY</strong><small>Whimsy online</small></span></a>
        <nav aria-label="Primary navigation"><a className="active" href="#play">Play</a><a href="#pulse">Pulse</a><a href="#about">About</a></nav>
        <div className="player-pill" aria-live="polite"><i /><span>{loading ? "Connecting…" : profile?.displayName ?? "Offline"}</span><strong>{profile ? `${profile.balance} Suds` : "—"}</strong></div>
      </header>

      <section className="hero" id="top">
        <div className="hero-orbit" aria-hidden="true"><span /><span /><span /></div>
        <p className="overline">Buffoonery Inc. Presents</p>
        <h1>buffoonery,<br /><em>on the web</em></h1>
        <p className="hero-copy">Magnus' little haven for all buffoons to enjoy.</p>
        <a className="hero-action" href="#play"><span>Enter the arcade</span><b>↓</b></a>
      </section>

      <section className="play-space" id="play" aria-labelledby="game-heading">
        <div className="game-intro">
          <span className="game-orb" aria-hidden="true"><b>?</b></span>
          <p className="overline">NOW PLAYING</p>
          <h2 id="game-heading">Odd or Even</h2>
          <p>Choose a side. We’ll roll the number and see what you get! Best of luck hehe! :)</p>
          <div className="rules"><span><small>PLAY</small>10 Suds</span><span><small>WIN</small>+10 Suds</span><span><small>CHANCE</small>50 / 50</span></div>
          <div className="soft-note"><span>i</span><p>This is the first game made on this website!</p></div>
        </div>

        <div className="game-stage">
          <div className="stage-head"><span>Choose odd or even, yo!</span><span>Round 001</span></div>
          <fieldset disabled={!profile || playing}><legend className="sr-only">Your choice</legend>
            <label className={choice === "odd" ? "choice selected" : "choice"}><input type="radio" name="choice" checked={choice === "odd"} onChange={() => setChoice("odd")} /><span className="number-set">1 · 3 · 5</span><strong>Odd</strong><small>this feels odd...</small><i>✓</i></label>
            <label className={choice === "even" ? "choice selected" : "choice"}><input type="radio" name="choice" checked={choice === "even"} onChange={() => setChoice("even")} /><span className="number-set">2 · 4 · 6</span><strong>Even</strong><small>even it out!</small><i>✓</i></label>
          </fieldset>
          <button className="roll" type="button" onClick={() => void play()} disabled={playing || !profile || profile.balance < 10}><span>{playing ? "Hmm..." : "Go for Gold"}</span><b>›</b></button>
          {loading && <p className="message">Finding your place…</p>}
          {accountError && <div className="message error" role="alert">Couldn’t find your player. <button onClick={() => void loadAccount()}>Try again</button></div>}
          {profile && profile.balance < 10 && <p className="message error">You need at least 10 Suds to play.</p>}
          {gameError && <p className="message error" role="alert">{gameError}</p>}
          {result && <div className={result.won ? "result won" : "result lost"} aria-live="polite"><span>{result.roll}</span><div><small>THE SIGNAL SAYS</small><h3>{result.won ? "SHABANG!!!" : "Almost."}</h3><p>{result.delta > 0 ? "+" : ""}{result.delta} Suds · {result.balance} remaining</p></div></div>}
        </div>
      </section>

      <section className="pulse" id="pulse"><span><i /> Everything feels clear</span><span>1 Thessalonians 5:16</span><span>"Rejoice always."</span></section>
      <section className="about" id="about"><article><span className="mini-orb">○</span><div><small>THIS SITE</small><h3>For fun, nothing serious</h3><p>This site is just for me to build cool things, mostly vibe coded.</p></div></article><article><span className="mini-orb blue">◇</span><div><small>AND SO?</small><h3>Stuff coming soon</h3><p>I would like to add more games, functions, reasons to come back and play!</p></div></article></section>
      <footer><a className="brand" href="#top"><span className="brand-mark"><b /></span><span><strong>BFNRY</strong><small>Whimsy online</small></span></a><p>IT'S JOHN MARSTON, MICAH!</p><div><a href="#play">Play</a><a href="#about">About</a></div></footer>
    </main>
  );
}
