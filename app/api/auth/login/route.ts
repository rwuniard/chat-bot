import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/cognito-auth";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session-token";

export async function POST(request: Request) {
  const { token } = await request.json();
  const user = verifyAuthToken(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const sessionToken = createSessionToken(user);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60,
    path: "/",
  });
  return response;
}
