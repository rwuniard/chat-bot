import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE_NAME = "chat-session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export interface SessionPayload {
  userId: string;
  email: string;
}

function sign(payload: SessionPayload & { exp: number }): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", process.env.NEXTAUTH_SECRET!)
    .update(encoded)
    .digest()
    .toString("base64url");
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = createHmac("sha256", process.env.NEXTAUTH_SECRET!)
    .update(encoded)
    .digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

export function createSessionToken(payload: SessionPayload): string {
  return sign({ ...payload, exp: Date.now() + SESSION_DURATION_MS });
}
