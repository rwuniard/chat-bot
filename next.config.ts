import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@aws-sdk/client-cognito-identity-provider",
    "@aws-sdk/client-bedrock-agentcore",
    "@aws-sdk/client-dynamodb",
    "@aws-sdk/lib-dynamodb",
  ],
};

export default nextConfig;
