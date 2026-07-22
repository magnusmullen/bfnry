import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { ensureDatabase } from "../../../db/setup";

async function identity(request: Request) {
  const user = await getChatGPTUser();
  const local = new URL(request.url).hostname === "localhost";
  if (!user && !local) return null;
  return user ? { email: user.email, displayName: user.displayName, demo: false } : { email: "local@bfnry.test", displayName: "Local Player", demo: true };
}

export async function GET(request: Request) {
  await ensureDatabase();
  const user = await identity(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO players (email, display_name, balance, created_at, updated_at) VALUES (?, ?, 100, ?, ?)").bind(user.email, user.displayName, now, now).run();
  const player = await env.DB.prepare("SELECT display_name, balance FROM players WHERE email = ?").bind(user.email).first<{ display_name: string; balance: number }>();
  return Response.json({ displayName: player?.display_name ?? user.displayName, balance: player?.balance ?? 100, demo: user.demo });
}
