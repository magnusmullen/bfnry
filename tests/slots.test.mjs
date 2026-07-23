import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getLuckyCallout, LUCKY_CALLOUTS } from "../app/lucky-callouts.ts";
import { evaluateLuckyBonus, evaluateSlotGrid, symbolFromRandom } from "../app/slots.ts";

test("LUCKY substitutes for the best regular symbol on a payline", () => {
  const grid = [
    ["A", "LUCKY", "A", "K", "Q"],
    ["10", "J", "Q", "K", "A"],
    ["K", "Q", "J", "10", "K"],
  ];

  const win = evaluateSlotGrid(grid, 20).find(({ line }) => line === 2);
  assert.deepEqual(win && { symbol: win.symbol, count: win.count, payout: win.payout }, { symbol: "A", count: 3, payout: 20 });
});

test("LUCKY occupies exactly one in every 28 random buckets", () => {
  const samples = Array.from({ length: 2800 }, (_, random) => symbolFromRandom(random));
  assert.equal(samples.filter((symbol) => symbol === "LUCKY").length, 100);
});

test("Lucky bonuses escalate at three, four, and five symbols", () => {
  const gridWith = (count) => {
    const symbols = Array(15).fill("10");
    symbols.fill("LUCKY", 0, count);
    return [symbols.slice(0, 5), symbols.slice(5, 10), symbols.slice(10, 15)];
  };

  assert.deepEqual(evaluateLuckyBonus(gridWith(3), 10), { count: 3, tier: "BIG BONUS", multiplier: 15, payout: 150 });
  assert.deepEqual(evaluateLuckyBonus(gridWith(4), 10), { count: 4, tier: "SUPER BONUS", multiplier: 50, payout: 500 });
  assert.deepEqual(evaluateLuckyBonus(gridWith(5), 10), { count: 5, tier: "BUFFOON BONUS", multiplier: 150, payout: 1500 });
});

test("bet controls use explicit mobile-safe buttons and functional updates", async () => {
  const arcade = await readFile(new URL("../app/Arcade.tsx", import.meta.url), "utf8");
  assert.match(arcade, /type="button" onClick=\{\(\) => \{ setBet\(\(current\) => Math\.max\(5, current - 5\)\)/);
  assert.match(arcade, /type="button" onClick=\{\(\) => \{ setBet\(\(current\) => Math\.min\(100, current \+ 5\)\)/);
  assert.match(arcade, /new AudioContextClass\(\)/);
});

test("Lucky tiles trigger a landing effect when their reel locks", async () => {
  const [arcade, css] = await Promise.all([
    readFile(new URL("../app/Arcade.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/slots.css", import.meta.url), "utf8"),
  ]);
  assert.match(arcade, /playLuckyHit\(luckyNumber\)/);
  assert.match(arcade, /luckyCountRef\.current \+= landedLuckies\.length/);
  assert.match(arcade, /lucky-float-callout/);
  assert.match(css, /@keyframes lucky-impact/);
  assert.match(css, /@keyframes lucky-ring/);
  assert.match(css, /@keyframes lucky-screen-flash/);
  assert.match(css, /@keyframes lucky-word-punch/);
  assert.match(css, /\.slot-cell\.lucky-landed\{transform:none;animation-name:lucky-cell-glow\}/);
  assert.match(css, /\.spinning \.slot-cell\.lucky-landed img\{animation:lucky-symbol-pop/);
  assert.match(arcade, /setLuckyLandings\(\{\}\); setPlaying\(false\)/);
  assert.doesNotMatch(css, /prefers-reduced-motion/);
});

test("Lucky landings pause later reels and two Luckies add suspense", async () => {
  const [arcade, css] = await Promise.all([
    readFile(new URL("../app/Arcade.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/slots.css", import.meta.url), "utf8"),
  ]);
  assert.match(arcade, /luckyCountRef\.current >= 2 \? 1700 : 350/);
  assert.match(arcade, /playSuspenseSound\(luckyCountRef\.current, suspenseDelay\)/);
  assert.match(arcade, /await new Promise\(\(resolve\) => window\.setTimeout\(resolve, suspenseDelay\)\)/);
  assert.match(arcade, /Hold your breath…/);
  assert.match(css, /@keyframes suspense-machine-pulse/);
});

test("Lucky art is enlarged and each landing gets a varied floating message", async () => {
  const [arcade, css] = await Promise.all([
    readFile(new URL("../app/Arcade.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/slots.css", import.meta.url), "utf8"),
  ]);
  assert.match(arcade, /14 \+ Math\.random\(\) \* 72/);
  assert.match(arcade, /getLuckyCallout\(level\)/);
  assert.match(css, /\.slot-cell\.lucky img\{[^}]*transform:scale\(1\.15\)/);
  assert.match(css, /@keyframes lucky-callout-float/);
});

test("each Lucky sequence position has its own editable phrase list", () => {
  assert.equal(LUCKY_CALLOUTS.length, 5);
  LUCKY_CALLOUTS.forEach((phrases) => assert.ok(phrases.length >= 3));
  assert.equal(getLuckyCallout(1, () => 0), LUCKY_CALLOUTS[0][0]);
  assert.equal(getLuckyCallout(2, () => 0), LUCKY_CALLOUTS[1][0]);
  assert.equal(getLuckyCallout(99, () => 0), LUCKY_CALLOUTS[4][0]);
});

test("Lucky effects are loaded and the baseline reels spin more deliberately", async () => {
  const [layout, arcade] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/Arcade.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /import "\.\/slots\.css";\s*import "\.\/globals\.css";/);
  assert.match(arcade, /}, 92\)/);
  assert.match(arcade, /Math\.max\(0, 760 - \(Date\.now\(\) - startedAt\)\)/);
  assert.match(arcade, /reel === 0 \? 170 : 260/);
  assert.match(arcade, /LUCKY" \? "\?v=4"/);
});

test("slot and ambient effects always animate regardless of motion preferences", async () => {
  const [arcade, slotsCss, globalCss] = await Promise.all([
    readFile(new URL("../app/Arcade.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/slots.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(arcade, /prefers-reduced-motion|reducedMotion/);
  assert.doesNotMatch(slotsCss, /prefers-reduced-motion/);
  assert.doesNotMatch(globalCss, /prefers-reduced-motion/);
});
