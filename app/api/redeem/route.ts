import { env } from "cloudflare:workers";
import { ensureDatabase } from "../../../db/setup";
import { getPlayerIdentity } from "../../player";

export async function POST(request: Request) {
  await ensureDatabase();
  const body = await request.json() as { code?: string };
  const code = body.code?.trim().toLowerCase();
  if (code !== "whimsicott") return Response.json({ error: "That code didn’t work" }, { status: 400 });

  const user = await getPlayerIdentity(request);
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO players (email, display_name, balance, created_at, updated_at) VALUES (?, ?, 100, ?, ?)").bind(user.email, user.displayName, now, now).run();
  const claim = await env.DB.prepare("INSERT OR IGNORE INTO promo_claims (player_email, code, created_at) VALUES (?, ?, ?)").bind(user.email, code, now).run();
  const awarded = Number(claim.meta.changes ?? 0) > 0;
  if (awarded) await env.DB.prepare("UPDATE players SET balance = balance + 100, updated_at = ? WHERE email = ?").bind(now, user.email).run();
  const player = await env.DB.prepare("SELECT balance FROM players WHERE email = ?").bind(user.email).first<{ balance: number }>();
  const response = Response.json({ displayName: user.displayName, balance: player?.balance ?? 100, demo: user.demo, awarded, promoClaimed: true });
  if (user.cookie) response.headers.set("Set-Cookie", user.cookie);
  return response;
}
