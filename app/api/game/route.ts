import { env } from "cloudflare:workers";
import { ensureDatabase } from "../../../db/setup";
import { getPlayerIdentity } from "../../player";

export async function POST(request: Request) {
  await ensureDatabase();
  const body = await request.json() as { choice?: string };
  if (body.choice !== "odd" && body.choice !== "even") return Response.json({ error: "Invalid choice" }, { status: 400 });
  const user = await getPlayerIdentity(request);
  const email = user.email;
  const displayName = user.displayName;
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO players (email, display_name, balance, created_at, updated_at) VALUES (?, ?, 100, ?, ?)").bind(email, displayName, now, now).run();
  const current = await env.DB.prepare("SELECT balance FROM players WHERE email = ?").bind(email).first<{ balance: number }>();
  if (!current || current.balance < 10) return Response.json({ error: "Not enough Suds" }, { status: 409 });
  const roll = crypto.getRandomValues(new Uint32Array(1))[0] % 100 + 1;
  const won = (roll % 2 === 0 ? "even" : "odd") === body.choice;
  const delta = won ? 10 : -10;
  const balance = current.balance + delta;
  await env.DB.batch([
    env.DB.prepare("UPDATE players SET balance = ?, updated_at = ? WHERE email = ?").bind(balance, now, email),
    env.DB.prepare("INSERT INTO game_results (player_email, choice, roll, delta, created_at) VALUES (?, ?, ?, ?, ?)").bind(email, body.choice, roll, delta, now),
  ]);
  const response = Response.json({ displayName, balance, demo: user.demo, roll, won, delta });
  if (user.cookie) response.headers.set("Set-Cookie", user.cookie);
  return response;
}
