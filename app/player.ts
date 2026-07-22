import { getChatGPTUser } from "./chatgpt-auth";

const PLAYER_COOKIE = "bfnry_player";

export type PlayerIdentity = {
  email: string;
  displayName: string;
  demo: boolean;
  cookie?: string;
};

export async function getPlayerIdentity(request: Request): Promise<PlayerIdentity> {
  const user = await getChatGPTUser();
  if (user) {
    return { email: user.email, displayName: user.displayName, demo: false };
  }

  const existingId = readCookie(request.headers.get("cookie"), PLAYER_COOKIE);
  const id = existingId && /^[a-f0-9-]{36}$/i.test(existingId)
    ? existingId
    : crypto.randomUUID();

  return {
    email: `guest-${id}@bfnry.local`,
    displayName: `Player ${id.slice(0, 6).toUpperCase()}`,
    demo: true,
    cookie: existingId ? undefined : serializePlayerCookie(id, request),
  };
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;

  for (const item of header.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }

  return null;
}

function serializePlayerCookie(id: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${PLAYER_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`;
}
