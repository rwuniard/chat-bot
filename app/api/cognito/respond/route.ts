import { NextResponse } from "next/server";
import { respondToNewPasswordChallenge, extractUserFromIdToken, signAuthToken } from "@/lib/cognito-auth";

export async function POST(request: Request) {
  const body = await request.json();
  const { username, newPassword, cognitoSession } = body;

  if (!username || !newPassword || !cognitoSession) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const result = await respondToNewPasswordChallenge(
      username as string,
      newPassword as string,
      cognitoSession as string
    );

    if (result.AuthenticationResult?.IdToken) {
      const user = extractUserFromIdToken(result.AuthenticationResult.IdToken);
      return NextResponse.json({ token: signAuthToken(user) });
    }

    return NextResponse.json({ error: "Failed to set new password" }, { status: 400 });
  } catch (error) {
    const name = (error as { name?: string }).name ?? "";
    const message =
      name === "InvalidPasswordException"
        ? "Password does not meet requirements"
        : "Failed to set new password";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
