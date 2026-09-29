export const CHIP_VALUES = [5, 25, 100, 500, 1000, 2500, 5000, 10000] as const;
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Card = { rank: Rank; suit: Suit; facedown?: boolean };
export type Hand = { cards: Card[]; bet: number; doubled?: boolean; splitAces?: boolean; awaitingCard?: boolean; done?: boolean; outcome?: string; sideBets?: { perfectPairs: number; hot3: number; perfectPairsOutcome?: string; perfectPairsOdds?: number; hot3Outcome?: string; hot3Odds?: number; payout: number } };

const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits: Suit[] = ["♠", "♥", "♦", "♣"];
export const valueOf = (card: Card) => card.rank === "A" ? 11 : ["K", "Q", "J"].includes(card.rank) ? 10 : Number(card.rank);
export function handValue(cards: Card[]) { let total = cards.reduce((sum, card) => sum + valueOf(card), 0); let aces = cards.filter((card) => card.rank === "A").length; while (total > 21 && aces) { total -= 10; aces--; } return { total, soft: aces > 0 }; }
export function isBlackjack(cards: Card[]) { return cards.length === 2 && handValue(cards).total === 21; }
export function isPair(cards: Card[]) { return cards.length === 2 && valueOf(cards[0]) === valueOf(cards[1]); }
export function countValue(card: Card) { return ["2", "3", "4", "5", "6"].includes(card.rank) ? 1 : ["10", "J", "Q", "K", "A"].includes(card.rank) ? -1 : 0; }
export type SideBetResult = { name: string; odds: number } | null;
const colourOf = (suit: Suit) => suit === "♥" || suit === "♦" ? "red" : "black";
const straight = (cards: Card[]) => {
  const values = cards.map((card) => card.rank === "A" ? 14 : card.rank === "K" ? 13 : card.rank === "Q" ? 12 : card.rank === "J" ? 11 : Number(card.rank));
  const unique = [...new Set(values)].sort((a, b) => a - b);
  return unique.length === 3 && (unique[2] - unique[0] === 2 || unique.join(",") === "2,3,14");
};
export function perfectPairsResult(cards: Card[]): SideBetResult {
  if (cards.length !== 2 || cards[0].rank !== cards[1].rank) return null;
  if (cards[0].suit === cards[1].suit) return { name: "Perfect pair", odds: 30 };
  if (colourOf(cards[0].suit) === colourOf(cards[1].suit)) return { name: "Colored pair", odds: 12 };
  return { name: "Mixed pair", odds: 5 };
}
export function hot3Result(cards: Card[]): SideBetResult {
  if (cards.length !== 3) return null;
  const highTotal = cards.reduce((sum, card) => sum + valueOf(card), 0);
  const aceCount = cards.filter((card) => card.rank === "A").length;
  const totals = Array.from({ length: aceCount + 1 }, (_, acesLow) => highTotal - acesLow * 10);
  const hasTotal = (total: number) => totals.includes(total);
  const sameSuit = cards.every((card) => card.suit === cards[0].suit);
  const sevenSevenSeven = cards.every((card) => card.rank === "7") && new Set(cards.map((card) => card.suit)).size === 3;
  if (sevenSevenSeven) return { name: "7-7-7", odds: 100 };
  if (hasTotal(21) && sameSuit) return { name: "Suited 21", odds: 20 };
  if (hasTotal(21)) return { name: "Unsuited 21", odds: 4 };
  if (hasTotal(20)) return { name: "Total 20", odds: 2 };
  if (hasTotal(19)) return { name: "Total 19", odds: 1 };
  return null;
}
export function freshShoe() { const shoe: Card[] = []; for (let deck = 0; deck < 6; deck++) for (const suit of suits) for (const rank of ranks) shoe.push({ rank, suit }); for (let i = shoe.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; } return shoe; }
