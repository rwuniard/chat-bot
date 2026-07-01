import { decode } from "next-auth/jwt";
import { cookies } from "next/headers";

export async function getSession() {
  const cookieStore = await cookies();

  // Next.js uses __Secure- prefix in production (HTTPS), plain name in dev (HTTP)
  const token =
    cookieStore.get("__Secure-next-auth.session-token")?.value ??
    cookieStore.get("next-auth.session-token")?.value;

  if (!token) return null;

  return decode({ token, secret: process.env.NEXTAUTH_SECRET! });
}
