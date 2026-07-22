import { env } from "cloudflare:workers";
import { ensureDatabase } from "../../../db/setup";
import { getPlayerIdentity } from "../../player";

export async function GET(request: Request) {
  await ensureDatabase();
  const user = await getPlayerIdentity(request);
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO players (email, display_name, balance, created_at, updated_at) VALUES (?, ?, 100, ?, ?)").bind(user.email, user.displayName, now, now).run();
  const player = await env.DB.prepare("SELECT display_name, balance FROM players WHERE email = ?").bind(user.email).first<{ display_name: string; balance: number }>();
  const response = Response.json({ displayName: player?.display_name ?? user.displayName, balance: player?.balance ?? 100, demo: user.demo });
  if (user.cookie) response.headers.set("Set-Cookie", user.cookie);
  return response;
}
