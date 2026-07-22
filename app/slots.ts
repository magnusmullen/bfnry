export const SLOT_SYMBOLS = ["A", "K", "Q", "J", "10"] as const;
export type SlotSymbol = typeof SLOT_SYMBOLS[number];
export type SlotGrid = SlotSymbol[][];

export const PAYLINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 1, 1, 1, 0], [2, 1, 1, 1, 2],
  [1, 2, 2, 2, 1], [1, 0, 0, 0, 1], [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2], [1, 0, 1, 0, 1], [1, 2, 1, 2, 1],
  [2, 2, 1, 2, 2], [0, 0, 1, 0, 0], [1, 1, 0, 1, 1],
  [1, 1, 2, 1, 1],
] as const;

const PAYTABLE: Record<SlotSymbol, Record<3 | 4 | 5, number>> = {
  A: { 3: 1, 4: 2.5, 5: 8 }, K: { 3: .8, 4: 2, 5: 6 },
  Q: { 3: .7, 4: 1.6, 5: 5 }, J: { 3: .6, 4: 1.3, 5: 4 },
  "10": { 3: .5, 4: 1, 5: 3 },
};

export type SlotWin = { line: number; symbol: SlotSymbol; count: 3 | 4 | 5; multiplier: number; payout: number; rows: readonly number[] };

export function evaluateSlotGrid(grid: SlotGrid, bet: number): SlotWin[] {
  const wins: SlotWin[] = [];
  PAYLINES.forEach((rows, index) => {
    const symbol = grid[rows[0]][0];
    let count = 1;
    while (count < 5 && grid[rows[count]][count] === symbol) count++;
    if (count >= 3) {
      const matched = count as 3 | 4 | 5;
      const multiplier = PAYTABLE[symbol][matched];
      wins.push({ line: index + 1, symbol, count: matched, multiplier, payout: Math.max(1, Math.round(bet * multiplier)), rows });
    }
  });
  return wins;
}
