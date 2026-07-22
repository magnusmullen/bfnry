import { env } from "cloudflare:workers";

let ready: Promise<void> | null = null;

export function ensureDatabase() {
  ready ??= initialize();
  return ready;
}

async function initialize() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS players (
      email TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      balance INTEGER DEFAULT 100 NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS game_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      player_email TEXT NOT NULL,
      choice TEXT NOT NULL,
      roll INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bonus_claims (
      player_email TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL
    )`),
  ]);
}
