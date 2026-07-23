"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PAYLINES, symbolFromRandom, type LuckyBonus, type SlotGrid, type SlotWin } from "./slots";

type Profile = { displayName: string; balance: number; demo: boolean; bonusClaimed?: boolean; promoClaimed?: boolean };
type GameResult = Profile & { roll: number; won: boolean; delta: number };
type SlotsResult = Profile & { grid: SlotGrid; wins: SlotWin[]; luckyBonus: LuckyBonus | null; payout: number; delta: number; bet: number };
type LuckyCallout = { id: number; message: string; x: number; y: number; rotation: number; level: number };
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
      const elapsed = now - startedAt;
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const luckyCountRef = useRef(0);
  const luckyCalloutIdRef = useRef(0);
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
  const [luckyLandings, setLuckyLandings] = useState<Record<string, number>>({});
  const [luckyImpact, setLuckyImpact] = useState({ token: 0, level: 0 });
  const [luckyCallouts, setLuckyCallouts] = useState<LuckyCallout[]>([]);
  const [suspenseLevel, setSuspenseLevel] = useState(0);
  const [bonusState, setBonusState] = useState<"idle" | "claiming" | "claimed">("idle");
  const [bonusMessage, setBonusMessage] = useState("");
  const [code, setCode] = useState("");
  const [redeemState, setRedeemState] = useState<"idle" | "redeeming" | "redeemed">("idle");
  const [redeemMessage, setRedeemMessage] = useState("");

  function playTone(frequency: number, duration = .08, delay = 0, wave: OscillatorType = "sine", volume = .045) {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;
    if (context.state === "suspended") void context.resume();
    const startsAt = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wave; oscillator.frequency.setValueAtTime(frequency, startsAt);
    gain.gain.setValueAtTime(volume, startsAt); gain.gain.exponentialRampToValueAtTime(.0001, startsAt + duration);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(startsAt); oscillator.stop(startsAt + duration);
  }

  function playResultSound(result: SlotsResult) {
    if (result.luckyBonus) {
      const notes = result.luckyBonus.count >= 5 ? [392, 523, 659, 784, 1047] : result.luckyBonus.count === 4 ? [392, 523, 659, 880] : [392, 523, 784];
      notes.forEach((frequency, index) => playTone(frequency, .24, index * .1, "triangle", .065));
    } else if (result.payout > 0) {
      [523, 659, 784].forEach((frequency, index) => playTone(frequency, .15, index * .08, "sine", .05));
    } else {
      playTone(180, .18, 0, "triangle", .035);
    }
  }

  function playLuckyHit(luckyNumber: number) {
    const lift = 2 ** ((Math.min(luckyNumber, 7) - 1) * 2 / 12);
    const root = 196 * lift;
    [1, 1.25, 1.5, 2].forEach((ratio, index) => playTone(root * ratio, .32 + index * .04, index * .012, index % 2 ? "sawtooth" : "triangle", .038));
    playTone(72 * lift, .38, 0, "sine", .09);
    playTone(root * 3, .12, .08, "square", .025);
    [2.5, 3, 4].forEach((ratio, index) => playTone(root * ratio, .28, .12 + index * .055, "sine", .032));
    if (luckyNumber >= 3) [1, 1.5, 2, 3].forEach((ratio, index) => playTone(root * ratio, .55, .2 + index * .035, "triangle", .045));
  }

  function playSuspenseSound(luckyCount: number, duration: number) {
    const beats = Math.max(4, Math.floor(duration / 190));
    for (let beat = 0; beat < beats; beat++) {
      const delay = beat * duration / beats / 1000;
      const climb = 1 + beat / beats * .42 + (luckyCount - 2) * .08;
      playTone(92 * climb, .12, delay, "sine", .052);
      playTone(184 * climb, .09, delay + .035, "triangle", .024);
    }
    playTone(440 * (1 + luckyCount * .08), .18, Math.max(0, duration / 1000 - .16), "sawtooth", .028);
  }

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
    playTone(260, .08, 0, "square", .025); playTone(390, .1, .07, "square", .025);
    luckyCountRef.current = 0;
    setPlaying(true); setStoppedReels(0); setLuckyLandings({}); setLuckyImpact({ token: 0, level: 0 }); setLuckyCallouts([]); setSuspenseLevel(0); setGameError(""); setSlotsResult(null);
    const startedAt = Date.now();
    let targetGrid: SlotGrid | null = null;
    let lockedReels = 0;
    const ticker = window.setInterval(() => {
      setGrid((current) => current.map((row, rowIndex) => row.map((symbol, reelIndex) =>
        targetGrid && reelIndex < lockedReels
          ? targetGrid[rowIndex][reelIndex]
          : symbolFromRandom(Math.floor(Math.random() * 0x100000000)) ?? symbol
      )) as SlotGrid);
    }, 92);
    try {
      const next = await readJson<SlotsResult>(await fetch("/api/slots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bet }) }));
      targetGrid = next.grid;
      const remainingLeadIn = Math.max(0, 760 - (Date.now() - startedAt));
      if (remainingLeadIn) await new Promise((resolve) => window.setTimeout(resolve, remainingLeadIn));
      for (let reel = 0; reel < 5; reel++) {
        await new Promise((resolve) => window.setTimeout(resolve, reel === 0 ? 170 : 260));
        lockedReels = reel + 1;
        playTone(170 + reel * 32, .07, 0, "square", .035);
        const landedLuckies = next.grid.flatMap((row, rowIndex) => row[reel] === "LUCKY" ? [`${rowIndex}-${reel}`] : []);
        if (landedLuckies.length) {
          const additions: Record<string, number> = {};
          landedLuckies.forEach((cellKey, luckyIndex) => {
            const luckyNumber = luckyCountRef.current + luckyIndex + 1;
            additions[cellKey] = luckyNumber;
            playLuckyHit(luckyNumber);
          });
          const messages = ["OH, LUCKY YOU!", "DOUBLE TROUBLE!", "JACKPOT ENERGY!", "FORTUNE FAVORS YOU!", "ABSOLUTE BUFFOONERY!"];
          const callouts = landedLuckies.map((_, luckyIndex) => {
            const level = luckyCountRef.current + luckyIndex + 1;
            return { id: ++luckyCalloutIdRef.current, message: messages[Math.min(level, messages.length) - 1], x: 14 + Math.random() * 72, y: 12 + Math.random() * 62, rotation: -12 + Math.random() * 24, level };
          });
          luckyCountRef.current += landedLuckies.length;
          setLuckyLandings((current) => ({ ...current, ...additions }));
          setLuckyCallouts((current) => [...current, ...callouts]);
          setLuckyImpact((current) => ({ token: current.token + 1, level: luckyCountRef.current }));
        }
        setStoppedReels(lockedReels);
        setGrid((current) => current.map((row, rowIndex) => row.map((symbol, reelIndex) =>
          reelIndex <= reel ? next.grid[rowIndex][reelIndex] : symbol
        )) as SlotGrid);
        if (reel < 4 && luckyCountRef.current > 0) {
          const suspenseDelay = luckyCountRef.current >= 2 ? 1700 : 350;
          setSuspenseLevel(luckyCountRef.current);
          if (luckyCountRef.current >= 2) playSuspenseSound(luckyCountRef.current, suspenseDelay);
          await new Promise((resolve) => window.setTimeout(resolve, suspenseDelay));
          setSuspenseLevel(0);
        }
      }
      setGrid(next.grid); setSlotsResult(next); setProfile(next); playResultSound(next);
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
    {luckyCallouts.map((callout) => <div className={`lucky-float-callout lucky-float-level-${Math.min(callout.level, 5)}`} key={callout.id} style={{ left: `${callout.x}%`, top: `${callout.y}%`, "--callout-rotation": `${callout.rotation}deg` } as React.CSSProperties} aria-hidden="true">{callout.message}</div>)}
    <button className={`bonus-bubble ${bonusState}`} type="button" onClick={() => void claimBonus()} disabled={bonusState !== "idle"} aria-label="Collect 30 bonus Suds"><span>{bonusState === "claiming" ? "…" : bonusState === "claimed" ? "✓" : "+30"}</span><small>{bonusMessage || "Suds"}</small></button>
    <header className="nav-shell"><a className="brand" href="#top" aria-label="BFNRY home"><span className="brand-mark"><b /></span><span><strong>BFNRY</strong><small>Whimsy online</small></span></a><nav aria-label="Primary navigation"><a className="active" href="#play">Play</a><a href="#pulse">Pulse</a><a href="#about">About</a></nav><div className="player-pill" aria-live="polite"><i /><span>{loading ? "Connecting…" : profile?.displayName ?? "Offline"}</span><strong>{profile ? `${profile.balance} Suds` : "—"}</strong></div></header>
    <section className="hero" id="top"><div className="hero-orbit" aria-hidden="true"><span /><span /><span /></div><p className="overline">Buffoonery Inc. Presents</p><h1>buffoonery,<br /><em>on the web</em></h1><p className="hero-copy">Magnus&apos; little haven for all buffoons to enjoy.</p><a className="hero-action" href="#play"><span>Enter the arcade</span><b>↓</b></a></section>

    <div className="game-tabs" role="tablist" aria-label="Choose a game"><button role="tab" aria-selected={game === "slots"} onClick={() => { setGame("slots"); setGameError(""); }}>Suds &amp; Symbols <small>NEW</small></button><button role="tab" aria-selected={game === "odd"} onClick={() => { setGame("odd"); setGameError(""); }}>Odd or Even</button></div>
    <section className={`play-space ${game === "slots" ? "slots-space" : ""}`} id="play" aria-labelledby="game-heading">
      <div className="game-intro"><span className="game-orb" aria-hidden="true"><b>{game === "slots" ? "5" : "?"}</b></span><p className="overline">NOW PLAYING</p><h2 id="game-heading">{game === "slots" ? "Suds & Symbols" : "Odd or Even"}</h2><p>{game === "slots" ? `Match 3–5 symbols from the left across any of ${PAYLINES.length} natural paylines. Every unique winning line pays.` : "Choose a side. We’ll roll the number and see what you get! Best of luck hehe! :)"}</p><div className="rules">{game === "slots" ? <><span><small>MIN BET</small>5 Suds</span><span><small>LINES</small>{PAYLINES.length} active</span><span><small>LUCKY</small>Wild + bonus</span></> : <><span><small>PLAY</small>10 Suds</span><span><small>WIN</small>+10 Suds</span><span><small>CHANCE</small>50 / 50</span></>}</div><div className="soft-note"><span>i</span><p>{game === "slots" ? "LUCKY is wild. Find 3 anywhere for a big bonus, 4 for super, or 5+ for buffoon." : "This is the first game made on this website!"}</p></div></div>

      {game === "slots" ? <div className="game-stage slot-stage">
        <div className="stage-head"><span>{PAYLINES.length} ways to make a splash</span><span>{suspenseLevel >= 2 ? "Hold your breath…" : slotsResult ? `${slotsResult.wins.length} line${slotsResult.wins.length === 1 ? "" : "s"} hit` : "Ready"}</span></div>
        <div className={`slot-machine ${playing ? "spinning" : ""} ${suspenseLevel >= 2 ? "lucky-suspense" : ""}`} aria-label="Three row by five reel slot result">
          <div className="slot-grid">{grid.map((row, rowIndex) => row.map((symbol, reelIndex) => { const cellKey = `${rowIndex}-${reelIndex}`; const luckyNumber = luckyLandings[cellKey]; return <div className={`slot-cell ${symbol === "LUCKY" ? "lucky" : ""} ${luckyNumber ? `lucky-landed lucky-level-${Math.min(luckyNumber, 5)}` : ""} ${playing && reelIndex >= stoppedReels ? "reel-spinning" : "reel-stopped"}`} key={cellKey}><img src={`/slots/${symbol}.png${symbol === "LUCKY" ? "?v=4" : ""}`} alt={playing && reelIndex >= stoppedReels ? "Spinning reel" : symbol} />{luckyNumber && <i className="lucky-starfield" aria-hidden="true" />}</div>; }))}</div>
          {luckyImpact.level > 0 && <div className={`lucky-screen-hit lucky-screen-level-${Math.min(luckyImpact.level, 5)}`} key={luckyImpact.token} aria-hidden="true" />}
          {suspenseLevel >= 2 && <div className="suspense-vignette" aria-hidden="true"><span>{suspenseLevel} LUCKIES…</span></div>}
          {slotsResult?.wins.length ? <PaylineCanvas wins={slotsResult.wins} /> : null}
        </div>
        <div className="bet-bar"><span>BET</span><button type="button" onClick={() => { setBet((current) => Math.max(5, current - 5)); playTone(360, .06, 0, "sine", .035); }} disabled={playing || bet <= 5} aria-label="Decrease bet">−</button><strong>{bet} <small>Suds</small></strong><button type="button" onClick={() => { setBet((current) => Math.min(100, current + 5)); playTone(520, .06, 0, "sine", .035); }} disabled={playing || bet >= 100} aria-label="Increase bet">+</button></div>
        <button className="roll slot-spin" type="button" onClick={() => void spin()} disabled={playing || !canPlay}><span>{playing ? "Spinning…" : `Spin for ${bet} Suds`}</span><b>›</b></button>
        {slotsResult && <div className={`slot-summary ${slotsResult.payout ? "won" : "lost"} ${slotsResult.luckyBonus ? "lucky-win" : ""}`} aria-live="polite">{slotsResult.luckyBonus && <div className="lucky-bonus"><small>{slotsResult.luckyBonus.count} LUCKIES</small><strong>{slotsResult.luckyBonus.tier}!</strong><span>{slotsResult.luckyBonus.multiplier}× BET · +{slotsResult.luckyBonus.payout} SUDS</span></div>}<div><small>{slotsResult.payout ? "TOTAL WIN" : "NO LINE WIN"}</small><strong>{slotsResult.payout ? `${slotsResult.payout} Suds` : "Try again"}</strong><span>{slotsResult.delta >= 0 ? "+" : ""}{slotsResult.delta} net · {slotsResult.balance} remaining</span></div>{slotsResult.wins.length > 0 && <div className="win-list">{slotsResult.wins.map((win, i) => <div className="win-chip" style={{ "--line-color": LINE_COLORS[i % LINE_COLORS.length] } as React.CSSProperties} key={win.line}><b>LINE {win.line}</b><span>{win.symbol} × {win.count}</span><strong>{win.multiplier}×</strong><em>+{win.payout}</em></div>)}</div>}</div>}
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
