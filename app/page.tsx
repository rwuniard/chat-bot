import { ChatShell } from "@/components/chat-shell";

function buildCognitoLogoutUrl(): string {
  const domain = process.env.COGNITO_DOMAIN ?? "";
  const clientId = process.env.COGNITO_CLIENT_ID ?? "";
  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const loginUrl = new URL("/login", appUrl).href;
  return `https://${domain}/logout?client_id=${clientId}&logout_uri=${loginUrl}`;
}

export default function Home() {
  return <ChatShell cognitoLogoutUrl={buildCognitoLogoutUrl()} />;
}
