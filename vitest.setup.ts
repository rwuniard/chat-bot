import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// The real "server-only" package unconditionally throws on import unless a
// bundler resolves its "react-server" condition (which Vitest/Node don't).
// Every server-side module in this project (lib/session-token.ts,
// lib/dynamodb-client.ts, lib/chat-history.ts, ...) imports it, so tests that
// import those modules need this mocked out to avoid crashing on import.
vi.mock("server-only", () => ({}));
