import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@aws-sdk/client-cognito-identity-provider",
    "@aws-sdk/client-bedrock-agentcore",
  ],
  // These are baked into .next/required-server-files.json at build time so the
  // Amplify SSR Lambda can read them from config.env on cold start. Without this,
  // Amplify does not forward console env vars to the Lambda's process.env.
  env: {
    COGNITO_REGION: process.env.COGNITO_REGION ?? "",
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID ?? "",
    COGNITO_CLIENT_SECRET: process.env.COGNITO_CLIENT_SECRET ?? "",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "",
    AGENT_RUNTIME_ARN: process.env.AGENT_RUNTIME_ARN ?? "",
    CHAT_ACTOR_ID: process.env.CHAT_ACTOR_ID ?? "",
  },
};

export default nextConfig;
