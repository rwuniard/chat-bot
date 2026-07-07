import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// React Testing Library's cleanup-between-tests only auto-registers when it
// detects a global `afterEach` (e.g. via `test.globals: true`); this project
// doesn't use globals, so it's wired up explicitly here instead, once, for
// every test file.
afterEach(() => {
  cleanup();
});

// The real "server-only" package unconditionally throws on import unless a
// bundler resolves its "react-server" condition (which Vitest/Node don't).
// Every server-side module in this project (lib/session-token.ts,
// lib/dynamodb-client.ts, lib/chat-history.ts, ...) imports it, so tests that
// import those modules need this mocked out to avoid crashing on import.
vi.mock("server-only", () => ({}));
