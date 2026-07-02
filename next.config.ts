import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@aws-sdk/client-cognito-identity-provider",
    "@aws-sdk/client-bedrock-agentcore",
  ],
};

export default nextConfig;
