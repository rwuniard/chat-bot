import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createHmac, timingSafeEqual } from "crypto";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION ?? "us-east-1",
});

function computeSecretHash(username: string): string {
  return createHmac("sha256", process.env.COGNITO_CLIENT_SECRET!)
    .update(username + process.env.COGNITO_CLIENT_ID!)
    .digest("base64");
}

export async function initiateAuth(username: string, password: string) {
  return cognitoClient.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: process.env.COGNITO_CLIENT_ID!,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        SECRET_HASH: computeSecretHash(username),
      },
    })
  );
}

export async function respondToNewPasswordChallenge(
  username: string,
  newPassword: string,
  session: string
) {
  return cognitoClient.send(
    new RespondToAuthChallengeCommand({
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      ClientId: process.env.COGNITO_CLIENT_ID!,
      ChallengeResponses: {
        USERNAME: username,
        NEW_PASSWORD: newPassword,
        SECRET_HASH: computeSecretHash(username),
      },
      Session: session,
    })
  );
}

export function signAuthToken(payload: { userId: string; email: string }): string {
  const data = JSON.stringify({ ...payload, exp: Date.now() + 5 * 60 * 1000 });
  const encoded = Buffer.from(data).toString("base64url");
  const sig = createHmac("sha256", process.env.NEXTAUTH_SECRET!)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyAuthToken(token: string): { userId: string; email: string } | null {
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

export function extractUserFromIdToken(idToken: string): { userId: string; email: string } {
  const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
  return {
    userId: payload.sub as string,
    email: (payload.email ?? payload["cognito:username"] ?? payload.sub) as string,
  };
}
