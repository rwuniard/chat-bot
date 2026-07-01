import { NextResponse } from "next/server";
import { initiateAuth, extractUserFromIdToken, signAuthToken } from "@/lib/cognito-auth";

export async function POST(request: Request) {
  const body = await request.json();
  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  try {
    const result = await initiateAuth(username as string, password as string);

    if (result.ChallengeName === "NEW_PASSWORD_REQUIRED") {
      return NextResponse.json({ requiresNewPassword: true, session: result.Session });
    }

    if (result.AuthenticationResult?.IdToken) {
      const user = extractUserFromIdToken(result.AuthenticationResult.IdToken);
      return NextResponse.json({ token: signAuthToken(user) });
    }

    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  } catch (error) {
    const name = (error as { name?: string }).name ?? "";
    console.error("[cognito/initiate] error:", name, (error as { message?: string }).message ?? "");
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
}
