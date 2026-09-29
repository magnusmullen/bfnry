import { env } from "cloudflare:workers";
import { ensureDatabase } from "../../../db/setup";
import { getPlayerIdentity } from "../../player";
import { CHIP_VALUES, countValue, freshShoe, handValue, hot3Result, isBlackjack, isPair, perfectPairsResult, type Card, type Hand } from "../../blackjack/engine";

type SideBets = { perfectPairs: number; hot3: number; perfectPairsOutcome?: string; perfectPairsOdds?: number; hot3Outcome?: string; hot3Odds?: number; payout: number };
type State = { shoe: Card[]; discard: Card[]; runningCount: number; dealer: Card[]; hands: Hand[]; active: number; phase: "betting" | "insurance" | "playing" | "complete"; insurance?: number; message: string };
const draw = (state: State) => { if (!state.shoe.length || (state.shoe.length <= 156 && state.phase !== "playing" && state.phase !== "insurance")) { state.shoe = freshShoe(); state.discard = []; state.runningCount = 0; } return state.shoe.pop()!; };
const exposed = (state: State, card: Card) => { state.runningCount += countValue(card); return card; };
const freshState = (): State => ({ shoe: freshShoe(), discard: [], runningCount: 0, dealer: [], hands: [], active: 0, phase: "betting", message: "Place your chips to begin." });
const serialize = (state: State) => ({ ...state, dealer: state.dealer.map((card, index) => index === 0 && state.phase !== "complete" ? { ...card, facedown: true } : card), trueCount: Number((state.runningCount / Math.max(.25, state.shoe.length / 52)).toFixed(1)), decksRemaining: Math.max(.1, state.shoe.length / 52) });
function finish(state: State) {
  const dealerValue = handValue(state.dealer).total;
  let credit = 0;
  for (const hand of state.hands) {
    const value = handValue(hand.cards).total;
    if (value > 21) hand.outcome = "Busted";
    else if (dealerValue > 21 || value > dealerValue) { hand.outcome = "Won"; credit += hand.bet * 2; }
    else if (value === dealerValue) { hand.outcome = "Push"; credit += hand.bet; }
    else hand.outcome = "Dealer wins";
  }
  state.phase = "complete"; state.message = dealerValue > 21 ? "Dealer busts." : "Dealer stands on " + dealerValue + ".";
  return credit;
}

export async function POST(request: Request) {
  await ensureDatabase(); const body = await request.json() as { action?: string; bet?: number; perfectPairsBet?: number; hot3Bet?: number; secondBet?: number; secondPerfectPairsBet?: number; secondHot3Bet?: number }; const user = await getPlayerIdentity(request); const now = new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO players (email, display_name, balance, created_at, updated_at) VALUES (?, ?, 100, ?, ?)").bind(user.email, user.displayName, now, now).run();
  const row = await env.DB.prepare("SELECT balance FROM players WHERE email = ?").bind(user.email).first<{ balance: number }>(); let balance = row?.balance ?? 100;
  const saved = await env.DB.prepare("SELECT state FROM blackjack_sessions WHERE player_email = ?").bind(user.email).first<{ state: string }>(); let state: State = saved ? JSON.parse(saved.state) as State : freshState(); let delta = 0;
  const charge = (amount: number) => { if (balance < amount) throw new Error("Not enough Suds for those chips."); balance -= amount; delta -= amount; };
  try {
    if (body.action === "status") { /* Return the saved shoe and in-progress hand without changing it. */ }
    else if (body.action === "reshuffle") { if (state.phase === "playing" || state.phase === "insurance") throw new Error("Finish this hand before reshuffling."); state = freshState(); state.message = "Six fresh decks shuffled. Count reset."; }
    else if (body.action === "deal") {
      const bet = Number(body.bet); const perfectPairsBet = Number(body.perfectPairsBet ?? 0); const hot3Bet = Number(body.hot3Bet ?? 0); const validSideBet = (amount: number) => Number.isInteger(amount) && amount >= 0 && amount % 5 === 0; if (!Number.isInteger(bet) || bet < 5 || bet % 5 !== 0 || !validSideBet(perfectPairsBet) || !validSideBet(hot3Bet)) throw new Error("Build wagers from 5-Sud chip increments."); if (state.phase === "playing" || state.phase === "insurance") throw new Error("Finish the current hand first."); state.discard.push(...state.dealer, ...state.hands.flatMap((hand) => hand.cards)); state.insurance = undefined; charge(bet + perfectPairsBet + hot3Bet); const first = exposed(state, draw(state)); const hole = draw(state); const second = exposed(state, draw(state)); state.hands = [{ cards: [first, second], bet }]; state.dealer = [hole, exposed(state, draw(state))]; const perfectPair = perfectPairsResult(state.hands[0].cards); const hot3 = hot3Result([first, second, state.dealer[1]]); const pairDescription = !perfectPair ? undefined : perfectPair.name === "Mixed pair" ? `Mixed-suit ${first.rank} pair` : perfectPair.name === "Colored pair" ? `Same-color ${first.rank} pair` : `Perfect ${first.rank}${first.suit} pair`; const sidePayout = (perfectPair ? perfectPairsBet * (perfectPair.odds + 1) : 0) + (hot3 ? hot3Bet * (hot3.odds + 1) : 0); state.sideBets = { perfectPairs: perfectPairsBet, hot3: hot3Bet, perfectPairsOutcome: pairDescription, perfectPairsOdds: perfectPair?.odds, hot3Outcome: hot3?.name, hot3Odds: hot3?.odds, payout: sidePayout }; if (sidePayout) { delta += sidePayout; balance += sidePayout; } state.active = 0; state.phase = "playing"; state.message = sidePayout ? `${[perfectPair && `${pairDescription} pays ${perfectPairsBet * (perfectPair.odds + 1)} Suds at ${perfectPair.odds}:1`, hot3 && `${hot3.name} pays ${hot3Bet * (hot3.odds + 1)} Suds at ${hot3.odds}:1`].filter(Boolean).join(" · ")}.` : "Your move.";
      const playerBJ = isBlackjack(state.hands[0].cards); const dealerUpAce = state.dealer[1].rank === "A";
      if (dealerUpAce) { state.phase = "insurance"; state.message = playerBJ ? "Blackjack! Take even money, or let the dealer check." : "Dealer shows an Ace. Insurance?"; }
      else if (playerBJ || isBlackjack(state.dealer)) { exposed(state, state.dealer[0]); state.phase = "complete"; if (playerBJ && !isBlackjack(state.dealer)) { state.hands[0].outcome = "Blackjack · 3:2"; delta += Math.round(bet * 2.5); balance += Math.round(bet * 2.5); } else if (playerBJ) { state.hands[0].outcome = "Push"; delta += bet; balance += bet; } else state.hands[0].outcome = "Dealer blackjack"; }
    } else if (body.action === "insurance" || body.action === "declineInsurance" || body.action === "evenMoney") {
      if (state.phase !== "insurance") throw new Error("Insurance is not available now."); const hand = state.hands[0];
      if (body.action === "evenMoney" && isBlackjack(hand.cards)) { delta += hand.bet * 2; balance += hand.bet * 2; hand.outcome = "Even money"; state.phase = "complete"; exposed(state, state.dealer[0]); }
      else { if (body.action === "insurance") { const insurance = hand.bet / 2; charge(insurance); state.insurance = insurance; } exposed(state, state.dealer[0]); if (isBlackjack(state.dealer)) { const insuranceCredit = state.insurance ? state.insurance * 3 : 0; delta += insuranceCredit; balance += insuranceCredit; const insuranceMessage = state.insurance ? `Insurance pays ${insuranceCredit} Suds back (+${insuranceCredit - state.insurance} profit).` : ""; hand.outcome = isBlackjack(hand.cards) ? "Push" : "Dealer blackjack"; if (isBlackjack(hand.cards)) { delta += hand.bet; balance += hand.bet; } state.message = insuranceMessage || "Dealer has blackjack."; state.phase = "complete"; } else if (isBlackjack(hand.cards)) { delta += Math.round(hand.bet * 2.5); balance += Math.round(hand.bet * 2.5); hand.outcome = "Blackjack · 3:2"; state.phase = "complete"; } else { state.phase = "playing"; state.message = "Dealer has no blackjack. Your move."; } }
    } else if (["hit", "stand", "double", "split"].includes(body.action ?? "")) {
      if (state.phase !== "playing") throw new Error("Deal a hand first."); const hand = state.hands[state.active];
      if (body.action === "split") { if (!isPair(hand.cards) || state.hands.length >= 5) throw new Error("Split requires a pair and no more than four splits."); charge(hand.bet); const aceSplit = hand.cards[0].rank === "A"; const second: Hand = { cards: [hand.cards.pop()!], bet: hand.bet, splitAces: aceSplit, awaitingCard: true }; hand.splitAces = aceSplit; state.hands.splice(state.active + 1, 0, second); hand.cards.push(exposed(state, draw(state))); if (aceSplit || handValue(hand.cards).total >= 21) { hand.done = true; state.active++; } }
      else if (body.action === "double") { if (hand.cards.length !== 2) throw new Error("Double down is only available on your first two cards."); charge(hand.bet); hand.bet *= 2; hand.doubled = true; hand.cards.push(exposed(state, draw(state))); hand.done = true; state.active++; }
      else if (body.action === "hit") { if (hand.splitAces) throw new Error("Split aces receive one card only."); hand.cards.push(exposed(state, draw(state))); if (handValue(hand.cards).total >= 21) { hand.done = true; if (handValue(hand.cards).total > 21) hand.outcome = "Busted"; state.active++; } }
      else { hand.done = true; state.active++; }
      while (state.active < state.hands.length && state.hands[state.active].done) state.active++;
      if (state.active < state.hands.length && state.hands[state.active].awaitingCard) { const nextHand = state.hands[state.active]; nextHand.cards.push(exposed(state, draw(state))); nextHand.awaitingCard = false; if (nextHand.splitAces || handValue(nextHand.cards).total >= 21) { nextHand.done = true; if (handValue(nextHand.cards).total > 21) nextHand.outcome = "Busted"; state.active++; while (state.active < state.hands.length && state.hands[state.active].done) state.active++; } }
      if (state.active >= state.hands.length) { state.dealer[0].facedown = false; exposed(state, state.dealer[0]); while (handValue(state.dealer).total < 17 || (handValue(state.dealer).total === 17 && handValue(state.dealer).soft)) state.dealer.push(exposed(state, draw(state))); const credit = finish(state); delta += credit; balance += credit; }
    } else throw new Error("Unknown blackjack action.");
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not play blackjack" }, { status: 400 }); }
  await env.DB.batch([env.DB.prepare("UPDATE players SET balance = ?, updated_at = ? WHERE email = ?").bind(balance, now, user.email), env.DB.prepare("INSERT OR REPLACE INTO blackjack_sessions (player_email, state, updated_at) VALUES (?, ?, ?)").bind(user.email, JSON.stringify(state), now)]);
  const response = Response.json({ displayName: user.displayName, balance, demo: user.demo, delta, ...serialize(state) }); if (user.cookie) response.headers.set("Set-Cookie", user.cookie); return response;
}
