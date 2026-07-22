import { env } from "cloudflare:workers";
import { ensureDatabase } from "../../../db/setup";
import { getPlayerIdentity } from "../../player";

const PROMO_CODES: Record<string, { reward: number; repeatable: boolean }> = {
  whimsicott: { reward: 100, repeatable: false },
  "muertos rojos": { reward: 175, repeatable: false },
  "for god so loved the world": { reward: 190, repeatable: true },
};

export async function POST(request: Request) {
  await ensureDatabase();
  const body = await request.json() as { code?: string };
  const code = body.code?.trim().toLowerCase();
  const promo = code ? PROMO_CODES[code] : undefined;
  if (!code || !promo) return Response.json({ error: "That code didn’t work" }, { status: 400 });

  const user = await getPlayerIdentity(request);
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO players (email, display_name, balance, created_at, updated_at) VALUES (?, ?, 100, ?, ?)").bind(user.email, user.displayName, now, now).run();

  let awarded = promo.repeatable;
  if (!promo.repeatable) {
    const legacyClaim = code === "whimsicott"
      ? await env.DB.prepare("SELECT player_email FROM promo_claims WHERE player_email = ?").bind(user.email).first()
      : null;
    if (!legacyClaim) {
      const claim = await env.DB.prepare("INSERT OR IGNORE INTO promo_code_claims (player_email, code, created_at) VALUES (?, ?, ?)").bind(user.email, code, now).run();
      awarded = Number(claim.meta.changes ?? 0) > 0;
    }
  }

  if (awarded) await env.DB.prepare("UPDATE players SET balance = balance + ?, updated_at = ? WHERE email = ?").bind(promo.reward, now, user.email).run();
  const player = await env.DB.prepare("SELECT balance FROM players WHERE email = ?").bind(user.email).first<{ balance: number }>();
  const response = Response.json({ displayName: user.displayName, balance: player?.balance ?? 100, demo: user.demo, awarded, reward: promo.reward, repeatable: promo.repeatable });
  if (user.cookie) response.headers.set("Set-Cookie", user.cookie);
  return response;
}
