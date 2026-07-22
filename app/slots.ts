export const REGULAR_SLOT_SYMBOLS = ["A", "K", "Q", "J", "10"] as const;
export const SLOT_SYMBOLS = [...REGULAR_SLOT_SYMBOLS, "LUCKY"] as const;
export type RegularSlotSymbol = typeof REGULAR_SLOT_SYMBOLS[number];
export type SlotSymbol = typeof SLOT_SYMBOLS[number];
export type SlotGrid = SlotSymbol[][];

export const LUCKY_CHANCE = 28;

export const PAYLINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 1, 1, 1, 0], [2, 1, 1, 1, 2],
  [1, 2, 2, 2, 1], [1, 0, 0, 0, 1], [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2], [1, 0, 1, 0, 1], [1, 2, 1, 2, 1],
  [2, 2, 1, 2, 2], [0, 0, 1, 0, 0], [1, 1, 0, 1, 1],
  [1, 1, 2, 1, 1],
] as const;

const PAYTABLE: Record<RegularSlotSymbol, Record<3 | 4 | 5, number>> = {
  A: { 3: 1, 4: 2.5, 5: 8 }, K: { 3: .8, 4: 2, 5: 6 },
  Q: { 3: .7, 4: 1.6, 5: 5 }, J: { 3: .6, 4: 1.3, 5: 4 },
  "10": { 3: .5, 4: 1, 5: 3 },
};

export type SlotWin = { line: number; symbol: RegularSlotSymbol; count: 3 | 4 | 5; multiplier: number; payout: number; rows: readonly number[] };
export type LuckyBonus = { count: number; tier: "BIG BONUS" | "SUPER BONUS" | "BUFFOON BONUS"; multiplier: number; payout: number };

export function symbolFromRandom(random: number): SlotSymbol {
  if (random % LUCKY_CHANCE === 0) return "LUCKY";
  return REGULAR_SLOT_SYMBOLS[Math.floor(random / LUCKY_CHANCE) % REGULAR_SLOT_SYMBOLS.length];
}

export function evaluateSlotGrid(grid: SlotGrid, bet: number): SlotWin[] {
  const wins: SlotWin[] = [];
  PAYLINES.forEach((rows, index) => {
    let best: SlotWin | null = null;
    for (const symbol of REGULAR_SLOT_SYMBOLS) {
      let count = 0;
      while (count < 5) {
        const shown = grid[rows[count]][count];
        if (shown !== symbol && shown !== "LUCKY") break;
        count++;
      }
      if (count < 3) continue;
      const matched = count as 3 | 4 | 5;
      const multiplier = PAYTABLE[symbol][matched];
      const candidate = { line: index + 1, symbol, count: matched, multiplier, payout: Math.max(1, Math.round(bet * multiplier)), rows };
      if (!best || candidate.payout > best.payout) best = candidate;
    }
    if (best) wins.push(best);
  });
  return wins;
}

export function evaluateLuckyBonus(grid: SlotGrid, bet: number): LuckyBonus | null {
  const count = grid.flat().filter((symbol) => symbol === "LUCKY").length;
  if (count < 3) return null;
  const tier = count >= 5 ? "BUFFOON BONUS" : count === 4 ? "SUPER BONUS" : "BIG BONUS";
  const multiplier = count >= 5 ? 150 : count === 4 ? 50 : 15;
  return { count, tier, multiplier, payout: bet * multiplier };
}
