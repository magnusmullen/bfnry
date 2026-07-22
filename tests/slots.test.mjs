import assert from "node:assert/strict";
import test from "node:test";
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
