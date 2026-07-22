import { env } from "cloudflare:workers";
import { ensureDatabase } from "../../../db/setup";
import { getPlayerIdentity } from "../../player";
import { evaluateSlotGrid, SLOT_SYMBOLS, type SlotGrid } from "../../slots";

export async function POST(request: Request) {
  await ensureDatabase();
  const body = await request.json() as { bet?: number };
  const bet = Number(body.bet);
  if (!Number.isInteger(bet) || bet < 5 || bet > 100) return Response.json({ error: "Bet must be between 5 and 100 Suds" }, { status: 400 });
  const user = await getPlayerIdentity(request);
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO players (email, display_name, balance, created_at, updated_at) VALUES (?, ?, 100, ?, ?)").bind(user.email, user.displayName, now, now).run();
  const current = await env.DB.prepare("SELECT balance FROM players WHERE email = ?").bind(user.email).first<{ balance: number }>();
  if (!current || current.balance < bet) return Response.json({ error: "Not enough Suds" }, { status: 409 });

  const random = crypto.getRandomValues(new Uint32Array(15));
  const grid = Array.from({ length: 3 }, (_, row) => Array.from({ length: 5 }, (_, reel) => SLOT_SYMBOLS[random[row * 5 + reel] % SLOT_SYMBOLS.length])) as SlotGrid;
  const wins = evaluateSlotGrid(grid, bet);
  const payout = wins.reduce((sum, win) => sum + win.payout, 0);
  const delta = payout - bet;
  const balance = current.balance + delta;
  await env.DB.batch([
    env.DB.prepare("UPDATE players SET balance = ?, updated_at = ? WHERE email = ? AND balance = ?").bind(balance, now, user.email, current.balance),
    env.DB.prepare("INSERT INTO slot_results (player_email, bet, payout, grid, created_at) VALUES (?, ?, ?, ?, ?)").bind(user.email, bet, payout, JSON.stringify(grid), now),
  ]);
  const response = Response.json({ displayName: user.displayName, balance, demo: user.demo, grid, wins, payout, delta, bet });
  if (user.cookie) response.headers.set("Set-Cookie", user.cookie);
  return response;
}
