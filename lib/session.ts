import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session-token";

export type { SessionPayload } from "@/lib/session-token";
export { verifySessionToken, createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session-token";

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
