import { env } from "cloudflare:workers";
import { ensureDatabase } from "../../../db/setup";
import { getPlayerIdentity } from "../../player";

export async function POST(request: Request) {
  await ensureDatabase();
  const body = await request.json() as { amount?: number };
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) return Response.json({ error: "Enter a whole amount between 1 and 1,000,000 Suds." }, { status: 400 });
  const user = await getPlayerIdentity(request);
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO players (email, display_name, balance, created_at, updated_at) VALUES (?, ?, 100, ?, ?)").bind(user.email, user.displayName, now, now).run();
  await env.DB.prepare("UPDATE players SET balance = balance + ?, updated_at = ? WHERE email = ?").bind(amount, now, user.email).run();
  const player = await env.DB.prepare("SELECT balance FROM players WHERE email = ?").bind(user.email).first<{ balance: number }>();
  const response = Response.json({ displayName: user.displayName, balance: player?.balance ?? 100 + amount, demo: user.demo, added: amount });
  if (user.cookie) response.headers.set("Set-Cookie", user.cookie);
  return response;
}
