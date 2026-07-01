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
    const msg = (error as { message?: string }).message ?? "";
    console.error("[cognito/initiate]", name, msg);
    const credentialErrors = new Set(["NotAuthorizedException", "UserNotFoundException"]);
    const clientError = credentialErrors.has(name)
      ? "Invalid username or password"
      : `Configuration error (${name || "unknown"}) — check server logs`;
    return NextResponse.json({ error: clientError }, { status: 401 });
  }
}
