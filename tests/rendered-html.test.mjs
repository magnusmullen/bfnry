import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("uses a persistent guest player when no authenticated user is available", async () => {
  const [player, account, game] = await Promise.all([
    readFile(new URL("app/player.ts", root), "utf8"),
    readFile(new URL("app/api/account/route.ts", root), "utf8"),
    readFile(new URL("app/api/game/route.ts", root), "utf8"),
  ]);

  assert.match(player, /crypto\.randomUUID\(\)/);
  assert.match(player, /HttpOnly; SameSite=Lax/);
  assert.match(account, /getPlayerIdentity\(request\)/);
  assert.match(account, /Set-Cookie/);
  assert.match(game, /getPlayerIdentity\(request\)/);
  assert.match(game, /Set-Cookie/);
  assert.doesNotMatch(account, /Sign in required/);
  assert.doesNotMatch(game, /Sign in required/);
});

test("renders the account and odd-or-even interface", async () => {
  const [arcade, css] = await Promise.all([
    readFile(new URL("app/Arcade.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(arcade, /Loading player\.\.\./);
  assert.match(arcade, /Try again/);
  assert.match(arcade, /type="radio"/);
  assert.match(arcade, /value="odd"/);
  assert.match(arcade, /value="even"/);
  assert.match(arcade, /Game error:/);
  assert.match(arcade, /className="game-console glass-card"/);
  assert.match(arcade, /Good vibes/);
  assert.match(css, /--sky:\s*#65c9ff/);
  assert.match(css, /linear-gradient/);
  assert.match(css, /backdrop-filter:\s*blur/);
});
