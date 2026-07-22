"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PAYLINES, SLOT_SYMBOLS, type SlotGrid, type SlotWin } from "./slots";

type Profile = { displayName: string; balance: number; demo: boolean; bonusClaimed?: boolean; promoClaimed?: boolean };
type GameResult = Profile & { roll: number; won: boolean; delta: number };
type SlotsResult = Profile & { grid: SlotGrid; wins: SlotWin[]; payout: number; delta: number; bet: number };
const START_GRID: SlotGrid = [["A", "K", "Q", "J", "10"], ["Q", "J", "10", "A", "K"], ["10", "A", "K", "Q", "J"]];
const LINE_COLORS = ["#ffe06f", "#ff8fa7", "#80f0dd", "#9db7ff", "#f7a9ff"];

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body;
}

function PaylineCanvas({ wins }: { wins: SlotWin[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let frame = 0;
    let startedAt = performance.now();
    const lineDuration = 380;
    const lineGap = 90;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const prepareCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = rect.width * scale; canvas.height = rect.height * scale;
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.scale(scale, scale); ctx.lineCap = "round"; ctx.lineJoin = "round";
      return { ctx, rect };
    };

    let prepared = prepareCanvas();
    const drawLine = (ctx: CanvasRenderingContext2D, rect: DOMRect, win: SlotWin, index: number, progress: number) => {
      if (progress <= 0) return;
      const points = win.rows.map((row, reel) => ({ x: (reel + .5) * rect.width / 5, y: (row + .5) * rect.height / 3 }));
      const travel = Math.min(4, progress * 4);
      ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
      for (let segment = 0; segment < 4; segment++) {
        if (travel >= segment + 1) ctx.lineTo(points[segment + 1].x, points[segment + 1].y);
        else if (travel > segment) {
          const amount = travel - segment;
          ctx.lineTo(points[segment].x + (points[segment + 1].x - points[segment].x) * amount, points[segment].y + (points[segment + 1].y - points[segment].y) * amount);
          break;
        } else break;
      }
      ctx.strokeStyle = LINE_COLORS[index % LINE_COLORS.length]; ctx.lineWidth = 4;
      ctx.shadowColor = "rgba(26,69,111,.55)"; ctx.shadowBlur = 6; ctx.stroke();
    };

    const draw = (now: number) => {
      if (!prepared) return;
      const { ctx, rect } = prepared;
      ctx.clearRect(0, 0, rect.width, rect.height);
      const elapsed = reducedMotion ? Number.POSITIVE_INFINITY : now - startedAt;
      wins.forEach((win, index) => {
        const progress = Math.min(1, Math.max(0, (elapsed - index * (lineDuration + lineGap)) / lineDuration));
        drawLine(ctx, rect, win, index, progress);
      });
      const totalDuration = Math.max(0, (wins.length - 1) * (lineDuration + lineGap) + lineDuration);
      if (elapsed < totalDuration) frame = window.requestAnimationFrame(draw);
    };

    const resize = () => { window.cancelAnimationFrame(frame); prepared = prepareCanvas(); startedAt = performance.now(); frame = window.requestAnimationFrame(draw); };
    frame = window.requestAnimationFrame(draw); window.addEventListener("resize", resize);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, [wins]);
  return <canvas className="payline-canvas" ref={ref} aria-hidden="true" />;
}

export function Arcade() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [game, setGame] = useState<"slots" | "odd">("slots");
  const [choice, setChoice] = useState<"odd" | "even">("odd");
  const [result, setResult] = useState<GameResult | null>(null);
  const [slotsResult, setSlotsResult] = useState<SlotsResult | null>(null);
  const [grid, setGrid] = useState<SlotGrid>(START_GRID);
  const [bet, setBet] = useState(5);
  const [accountError, setAccountError] = useState("");
  const [gameError, setGameError] = useState("");
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [stoppedReels, setStoppedReels] = useState(5);
  const [bonusState, setBonusState] = useState<"idle" | "claiming" | "claimed">("idle");
  const [bonusMessage, setBonusMessage] = useState("");
  const [code, setCode] = useState("");
  const [redeemState, setRedeemState] = useState<"idle" | "redeeming" | "redeemed">("idle");
  const [redeemMessage, setRedeemMessage] = useState("");

  const loadAccount = useCallback(async () => {
    setLoading(true); setAccountError("");
    try {
      const next = await readJson<Profile>(await fetch("/api/account", { cache: "no-store" })); setProfile(next);
      if (next.bonusClaimed) { setBonusState("claimed"); setBonusMessage("Collected"); }
    } catch (error) { setAccountError(error instanceof Error ? error.message : "Could not load player"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadAccount(); }, [loadAccount]);

  async function playOddEven() {
    setPlaying(true); setGameError("");
    try { const next = await readJson<GameResult>(await fetch("/api/game", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ choice }) })); setResult(next); setProfile(next); }
    catch (error) { setGameError(error instanceof Error ? error.message : "Could not play game"); }
    finally { setPlaying(false); }
  }
  async function spin() {
    setPlaying(true); setStoppedReels(0); setGameError(""); setSlotsResult(null);
    const startedAt = Date.now();
    let targetGrid: SlotGrid | null = null;
    let lockedReels = 0;
    const ticker = window.setInterval(() => {
      setGrid((current) => current.map((row, rowIndex) => row.map((symbol, reelIndex) =>
        targetGrid && reelIndex < lockedReels
          ? targetGrid[rowIndex][reelIndex]
          : SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)] ?? symbol
      )) as SlotGrid);
    }, 72);
    try {
      const next = await readJson<SlotsResult>(await fetch("/api/slots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bet }) }));
      targetGrid = next.grid;
      const remainingLeadIn = Math.max(0, 620 - (Date.now() - startedAt));
      if (remainingLeadIn) await new Promise((resolve) => window.setTimeout(resolve, remainingLeadIn));
      for (let reel = 0; reel < 5; reel++) {
        await new Promise((resolve) => window.setTimeout(resolve, reel === 0 ? 120 : 190));
        lockedReels = reel + 1;
        setStoppedReels(lockedReels);
        setGrid((current) => current.map((row, rowIndex) => row.map((symbol, reelIndex) =>
          reelIndex <= reel ? next.grid[rowIndex][reelIndex] : symbol
        )) as SlotGrid);
      }
      setGrid(next.grid); setSlotsResult(next); setProfile(next);
    } catch (error) { setGameError(error instanceof Error ? error.message : "The reels got stuck"); }
    finally { window.clearInterval(ticker); setStoppedReels(5); setPlaying(false); }
  }
  async function claimBonus() {
    if (bonusState !== "idle") return; setBonusState("claiming"); setBonusMessage("");
    try { const next = await readJson<Profile & { awarded: boolean }>(await fetch("/api/bonus", { method: "POST" })); setProfile(next); setBonusState("claimed"); setBonusMessage(next.awarded ? "+30 Suds" : "Already collected"); }
    catch { setBonusState("idle"); setBonusMessage("Bubble slipped away"); }
  }
  async function redeemCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!code.trim() || redeemState !== "idle") return; setRedeemState("redeeming"); setRedeemMessage("");
    try { const next = await readJson<Profile & { awarded: boolean; reward: number }>(await fetch("/api/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) })); setProfile(next); setCode(""); setRedeemMessage(next.awarded ? `+${next.reward} Suds added` : "Code already redeemed"); }
    catch (error) { setRedeemMessage(error instanceof Error ? error.message : "That code didn’t work"); }
    finally { setRedeemState("idle"); }
  }
  const canPlay = !!profile && profile.balance >= (game === "slots" ? bet : 10);

  return <main className="site-shell">
    <div className="ambient" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    <button className={`bonus-bubble ${bonusState}`} type="button" onClick={() => void claimBonus()} disabled={bonusState !== "idle"} aria-label="Collect 30 bonus Suds"><span>{bonusState === "claiming" ? "…" : bonusState === "claimed" ? "✓" : "+30"}</span><small>{bonusMessage || "Suds"}</small></button>
    <header className="nav-shell"><a className="brand" href="#top" aria-label="BFNRY home"><span className="brand-mark"><b /></span><span><strong>BFNRY</strong><small>Whimsy online</small></span></a><nav aria-label="Primary navigation"><a className="active" href="#play">Play</a><a href="#pulse">Pulse</a><a href="#about">About</a></nav><div className="player-pill" aria-live="polite"><i /><span>{loading ? "Connecting…" : profile?.displayName ?? "Offline"}</span><strong>{profile ? `${profile.balance} Suds` : "—"}</strong></div></header>
    <section className="hero" id="top"><div className="hero-orbit" aria-hidden="true"><span /><span /><span /></div><p className="overline">Buffoonery Inc. Presents</p><h1>buffoonery,<br /><em>on the web</em></h1><p className="hero-copy">Magnus&apos; little haven for all buffoons to enjoy.</p><a className="hero-action" href="#play"><span>Enter the arcade</span><b>↓</b></a></section>

    <div className="game-tabs" role="tablist" aria-label="Choose a game"><button role="tab" aria-selected={game === "slots"} onClick={() => { setGame("slots"); setGameError(""); }}>Suds &amp; Symbols <small>NEW</small></button><button role="tab" aria-selected={game === "odd"} onClick={() => { setGame("odd"); setGameError(""); }}>Odd or Even</button></div>
    <section className={`play-space ${game === "slots" ? "slots-space" : ""}`} id="play" aria-labelledby="game-heading">
      <div className="game-intro"><span className="game-orb" aria-hidden="true"><b>{game === "slots" ? "5" : "?"}</b></span><p className="overline">NOW PLAYING</p><h2 id="game-heading">{game === "slots" ? "Suds & Symbols" : "Odd or Even"}</h2><p>{game === "slots" ? `Match 3–5 symbols from the left across any of ${PAYLINES.length} natural paylines. Every unique winning line pays.` : "Choose a side. We’ll roll the number and see what you get! Best of luck hehe! :)"}</p><div className="rules">{game === "slots" ? <><span><small>MIN BET</small>5 Suds</span><span><small>LINES</small>{PAYLINES.length} active</span><span><small>MATCH</small>3 / 4 / 5</span></> : <><span><small>PLAY</small>10 Suds</span><span><small>WIN</small>+10 Suds</span><span><small>CHANCE</small>50 / 50</span></>}</div><div className="soft-note"><span>i</span><p>{game === "slots" ? "A pays highest, followed by K, Q, J, then 10." : "This is the first game made on this website!"}</p></div></div>

      {game === "slots" ? <div className="game-stage slot-stage">
        <div className="stage-head"><span>{PAYLINES.length} ways to make a splash</span><span>{slotsResult ? `${slotsResult.wins.length} line${slotsResult.wins.length === 1 ? "" : "s"} hit` : "Ready"}</span></div>
        <div className={`slot-machine ${playing ? "spinning" : ""}`} aria-label="Three row by five reel slot result">
          <div className="slot-grid">{grid.map((row, rowIndex) => row.map((symbol, reelIndex) => <div className={`slot-cell ${playing && reelIndex >= stoppedReels ? "reel-spinning" : "reel-stopped"}`} key={`${rowIndex}-${reelIndex}`}><img src={`/slots/${symbol}.png`} alt={playing && reelIndex >= stoppedReels ? "Spinning reel" : symbol} /></div>))}</div>
          {slotsResult?.wins.length ? <PaylineCanvas wins={slotsResult.wins} /> : null}
        </div>
        <div className="bet-bar"><span>BET</span><button onClick={() => setBet(Math.max(5, bet - 5))} disabled={playing || bet <= 5} aria-label="Decrease bet">−</button><strong>{bet} <small>Suds</small></strong><button onClick={() => setBet(Math.min(100, bet + 5))} disabled={playing || bet >= 100} aria-label="Increase bet">+</button></div>
        <button className="roll slot-spin" type="button" onClick={() => void spin()} disabled={playing || !canPlay}><span>{playing ? "Spinning…" : `Spin for ${bet} Suds`}</span><b>›</b></button>
        {slotsResult && <div className={`slot-summary ${slotsResult.payout ? "won" : "lost"}`} aria-live="polite"><div><small>{slotsResult.payout ? "TOTAL WIN" : "NO LINE WIN"}</small><strong>{slotsResult.payout ? `${slotsResult.payout} Suds` : "Try again"}</strong><span>{slotsResult.delta >= 0 ? "+" : ""}{slotsResult.delta} net · {slotsResult.balance} remaining</span></div>{slotsResult.wins.length > 0 && <div className="win-list">{slotsResult.wins.map((win, i) => <div className="win-chip" style={{ "--line-color": LINE_COLORS[i % LINE_COLORS.length] } as React.CSSProperties} key={win.line}><b>LINE {win.line}</b><span>{win.symbol} × {win.count}</span><strong>{win.multiplier}×</strong><em>+{win.payout}</em></div>)}</div>}</div>}
        {!slotsResult && <p className="pay-hint">Each winning line has its own multiplier and payout.</p>}
        {profile && profile.balance < bet && <p className="message error">Lower your bet or collect more Suds.</p>}
        {gameError && <p className="message error" role="alert">{gameError}</p>}
      </div> : <div className="game-stage"><div className="stage-head"><span>Choose odd or even, yo!</span><span>Round 001</span></div><fieldset disabled={!profile || playing}><legend className="sr-only">Your choice</legend><label className={choice === "odd" ? "choice selected" : "choice"}><input type="radio" name="choice" value="odd" checked={choice === "odd"} onChange={() => setChoice("odd")} /><span className="number-set">1 · 3 · 5</span><strong>Odd</strong><small>this feels odd...</small><i>✓</i></label><label className={choice === "even" ? "choice selected" : "choice"}><input type="radio" name="choice" value="even" checked={choice === "even"} onChange={() => setChoice("even")} /><span className="number-set">2 · 4 · 6</span><strong>Even</strong><small>even it out!</small><i>✓</i></label></fieldset><button className="roll" type="button" onClick={() => void playOddEven()} disabled={playing || !canPlay}><span>{playing ? "Hmm..." : "Go for Gold"}</span><b>›</b></button>{result && <div className={result.won ? "result won" : "result lost"} aria-live="polite"><span>{result.roll}</span><div><small>THE SIGNAL SAYS</small><h3>{result.won ? "SHABANG!!!" : "Almost."}</h3><p>{result.delta > 0 ? "+" : ""}{result.delta} Suds · {result.balance} remaining</p></div></div>}{gameError && <p className="message error" role="alert">{gameError}</p>}</div>}
    </section>
    {loading && <p className="message">Finding your place…</p>}{accountError && <div className="message error" role="alert">Couldn’t find your player. <button onClick={() => void loadAccount()}>Try again</button></div>}
    <section className="pulse" id="pulse"><span><i /> Everything feels clear</span><span>1 Thessalonians 5:16</span><span>&quot;Rejoice always.&quot;</span></section><section className="about" id="about"><article><span className="mini-orb">○</span><div><small>THIS SITE</small><h3>For fun, nothing serious</h3><p>This site is just for me to build cool things, mostly vibe coded.</p></div></article><article><span className="mini-orb blue">◇</span><div><small>AND SO?</small><h3>More ways to play</h3><p>Try the new 20-line slots, then switch back to the original game anytime.</p></div></article></section>
    <form className="code-entry" onSubmit={(event) => void redeemCode(event)}><label htmlFor="secret-code">Have a code?</label><div><input id="secret-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter it here" autoComplete="off" disabled={redeemState !== "idle"} /><button type="submit" disabled={!code.trim() || redeemState !== "idle"}>{redeemState === "redeeming" ? "Checking…" : "Redeem"}</button></div><p aria-live="polite">{redeemMessage}</p></form><footer><a className="brand" href="#top"><span className="brand-mark"><b /></span><span><strong>BFNRY</strong><small>Whimsy online</small></span></a><p>IT&apos;S JOHN MARSTON, MICAH!</p><div><a href="#play">Play</a><a href="#about">About</a></div></footer>
  </main>;
}
