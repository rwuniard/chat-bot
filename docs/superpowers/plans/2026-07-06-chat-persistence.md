# Chat Persistence (DynamoDB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist chat conversations per user to DynamoDB so they survive page reloads, and give the sidebar a real, selectable list of past conversations.

**Architecture:** Two DynamoDB tables (`ChatConversations`, `ChatMessages`) sit behind a new `lib/chat-history.ts` module, consumed by two new read-only API routes and the existing chat-send route (which now persists alongside its existing streaming pass-through behavior). Client-side, `ChatShell` becomes the owner of the conversation list and wires it into `ChatSidebar` (selection) and `MainChat` (loading/continuing a conversation).

**Tech Stack:** Next.js 16 App Router route handlers, `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb`, React 19 client components, Vitest + React Testing Library + jsdom (newly added by this plan — the project currently has zero test infrastructure).

**Design doc:** `docs/superpowers/specs/2026-07-06-chat-persistence-design.md` — read this first for the full rationale (data model, ownership checks, scaling notes, sequence diagrams). This plan implements it task-by-task.

## Global Constraints

- Package manager is pnpm — use `pnpm add` / `pnpm add -D`, never npm/yarn.
- TypeScript strict mode is on (`tsconfig.json`) — no implicit `any`, handle `undefined` explicitly.
- Path alias `@/*` resolves to the project root (e.g. `@/lib/session`).
- New AWS SDK packages that touch Node-only APIs must be added to `serverExternalPackages` in `next.config.ts`, matching the existing `@aws-sdk/client-bedrock-agentcore` / `@aws-sdk/client-cognito-identity-provider` entries.
- `params` in dynamic Route Handlers is a `Promise` in this Next.js version (16.2.6) — always `await params`.
- Never log chat message `content` to the server console — only ids, roles, and error objects.
- DynamoDB persistence is best-effort relative to the live chat experience: failures are logged and swallowed, except an ownership mismatch (`ConversationNotFoundError`), which is a deliberate rejection surfaced to the client as an error.
- Test runner is Vitest + React Testing Library + jsdom (installed in Task 1) — run with `pnpm test`.

---

### Task 1: Test tooling (Vitest + React Testing Library)

This project has no test runner at all today. This task installs and wires one up, following the official Next.js 16 Vitest guide, before any TDD work in later tasks can begin.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.mts`
- Create: `vitest.setup.ts`
- Create: `__tests__/smoke.test.ts`

**Interfaces:**
- Produces: a `pnpm test` script that runs Vitest once (non-watch) and exits with a pass/fail code; a `vitest.setup.ts` that mocks the `server-only` package (its real implementation unconditionally throws outside a `react-server` bundler condition, which would otherwise crash every test that imports a server-only module) and loads `@testing-library/jest-dom` matchers.

- [ ] **Step 1: Install test dependencies**

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom vite-tsconfig-paths
```

- [ ] **Step 2: Add test scripts to package.json**

Add these two entries to the existing `"scripts"` object in `package.json` (alongside `dev`, `build`, `start`, `lint`):

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create the Vitest config**

Create `vitest.config.mts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

- [ ] **Step 4: Create the test setup file**

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// The real "server-only" package unconditionally throws on import unless a
// bundler resolves its "react-server" condition (which Vitest/Node don't).
// Every server-side module in this project (lib/session-token.ts,
// lib/dynamodb-client.ts, lib/chat-history.ts, ...) imports it, so tests that
// import those modules need this mocked out to avoid crashing on import.
vi.mock("server-only", () => ({}));
```

- [ ] **Step 5: Write a smoke test**

Create `__tests__/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("vitest setup", () => {
  it("runs a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the test suite and verify it passes**

Run: `pnpm test`
Expected: 1 test file, 1 test, PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.mts vitest.setup.ts __tests__/smoke.test.ts
git commit -m "test: add Vitest + React Testing Library tooling"
```

---

### Task 2: DynamoDB client module

**Files:**
- Create: `lib/dynamodb-client.ts`
- Test: `__tests__/lib/dynamodb-client.test.ts`
- Modify: `next.config.ts`
- Modify: `.env.local.example`
- Modify: `amplify.yml`
- Modify: `package.json` (dependencies)

**Interfaces:**
- Produces: `docClient: DynamoDBDocumentClient` and `getTableNames(): { conversations: string; messages: string }`, both imported by `lib/chat-history.ts` in later tasks.

- [ ] **Step 1: Install the DynamoDB SDK packages**

```bash
pnpm add @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/lib/dynamodb-client.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { getTableNames } from "@/lib/dynamodb-client";

const originalConversationsTable = process.env.CHAT_CONVERSATIONS_TABLE;
const originalMessagesTable = process.env.CHAT_MESSAGES_TABLE;

afterEach(() => {
  process.env.CHAT_CONVERSATIONS_TABLE = originalConversationsTable;
  process.env.CHAT_MESSAGES_TABLE = originalMessagesTable;
});

describe("getTableNames", () => {
  it("falls back to default table names when env vars are unset", () => {
    delete process.env.CHAT_CONVERSATIONS_TABLE;
    delete process.env.CHAT_MESSAGES_TABLE;

    expect(getTableNames()).toEqual({
      conversations: "ChatConversations",
      messages: "ChatMessages",
    });
  });

  it("uses the env vars when set", () => {
    process.env.CHAT_CONVERSATIONS_TABLE = "MyConversations";
    process.env.CHAT_MESSAGES_TABLE = "MyMessages";

    expect(getTableNames()).toEqual({
      conversations: "MyConversations",
      messages: "MyMessages",
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test dynamodb-client`
Expected: FAIL — `lib/dynamodb-client.ts` does not exist yet.

- [ ] **Step 4: Write the implementation**

Create `lib/dynamodb-client.ts`:

```ts
import "server-only";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const AWS_REGION = process.env.COGNITO_REGION || "us-east-1";

const rawClient = new DynamoDBClient({ region: AWS_REGION });

export const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true },
});

export interface ChatHistoryTableNames {
  readonly conversations: string;
  readonly messages: string;
}

export function getTableNames(): ChatHistoryTableNames {
  return {
    conversations: process.env.CHAT_CONVERSATIONS_TABLE || "ChatConversations",
    messages: process.env.CHAT_MESSAGES_TABLE || "ChatMessages",
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test dynamodb-client`
Expected: PASS (2 tests).

- [ ] **Step 6: Register the new packages as server-external**

In `next.config.ts`, update `serverExternalPackages` (currently lines 4-7):

```ts
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
```

- [ ] **Step 7: Document the new env vars**

Add to `.env.local.example` (after the existing `AGENT_RUNTIME_ARN` line):

```
# DynamoDB tables for chat persistence (sidebar history). See
# docs/superpowers/specs/2026-07-06-chat-persistence-design.md for the schema.
CHAT_CONVERSATIONS_TABLE=ChatConversations
CHAT_MESSAGES_TABLE=ChatMessages
```

- [ ] **Step 8: Pass the new env vars through in the Amplify build**

In `amplify.yml`, update the `env | grep` line (currently line 11):

```yaml
        - env | grep -e ^COGNITO_ -e ^NEXTAUTH_ -e ^AGENT_RUNTIME_ARN= -e ^CHAT_ACTOR_ID= -e ^CHAT_CONVERSATIONS_TABLE= -e ^CHAT_MESSAGES_TABLE= >> .env.production
```

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml lib/dynamodb-client.ts __tests__/lib/dynamodb-client.test.ts next.config.ts .env.local.example amplify.yml
git commit -m "feat: add DynamoDB client and table name config"
```

---

### Task 3: Conversation title helper

**Files:**
- Create: `lib/conversation-title.ts`
- Test: `__tests__/lib/conversation-title.test.ts`

**Interfaces:**
- Produces: `buildConversationTitle(message: string): string`, used by `lib/chat-history.ts` in Task 4.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/conversation-title.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildConversationTitle } from "@/lib/conversation-title";

describe("buildConversationTitle", () => {
  it("returns short messages unchanged, trimmed", () => {
    expect(buildConversationTitle("  Hello there  ")).toBe("Hello there");
  });

  it("truncates long messages and appends an ellipsis", () => {
    const longMessage = "a".repeat(80);

    const title = buildConversationTitle(longMessage);

    expect(title).toBe(`${"a".repeat(60)}…`);
  });

  it("does not leave trailing whitespace before the ellipsis", () => {
    const message = `${"a".repeat(59)} ${"b".repeat(20)}`;

    const title = buildConversationTitle(message);

    expect(title.endsWith(" …")).toBe(false);
    expect(title.endsWith("…")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test conversation-title`
Expected: FAIL — `lib/conversation-title.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `lib/conversation-title.ts`:

```ts
const MAX_TITLE_LENGTH = 60;

export function buildConversationTitle(message: string): string {
  const trimmed = message.trim();

  if (trimmed.length <= MAX_TITLE_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test conversation-title`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/conversation-title.ts __tests__/lib/conversation-title.test.ts
git commit -m "feat: add conversation title truncation helper"
```

---

### Task 4: chat-history.ts — create and continue a conversation

Implements the write path from the design doc: atomic conversation-plus-first-message creation via `TransactWriteItems`, and conditional continuation that rejects with `ConversationNotFoundError` on an ownership mismatch.

**Files:**
- Create: `lib/chat-history.ts`
- Test: `__tests__/lib/chat-history.test.ts`

**Interfaces:**
- Consumes: `docClient`, `getTableNames()` from `@/lib/dynamodb-client` (Task 2); `buildConversationTitle(message: string): string` from `@/lib/conversation-title` (Task 3); `ChatMessage` from `@/types/chat`.
- Produces: `ConversationNotFoundError`, `createConversationWithFirstMessage(userId: string, sessionId: string, userMessage: ChatMessage): Promise<void>`, `appendUserMessageToConversation(userId: string, sessionId: string, userMessage: ChatMessage): Promise<void>` (throws `ConversationNotFoundError` on ownership mismatch) — all consumed by Task 9 (`app/api/chat/route.ts`).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/chat-history.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/types/chat";

vi.mock("@/lib/dynamodb-client", () => ({
  docClient: { send: vi.fn() },
  getTableNames: () => ({ conversations: "TestConversations", messages: "TestMessages" }),
}));

import { docClient } from "@/lib/dynamodb-client";
import {
  ConversationNotFoundError,
  appendUserMessageToConversation,
  createConversationWithFirstMessage,
} from "@/lib/chat-history";

const send = docClient.send as unknown as ReturnType<typeof vi.fn>;

const userMessage: ChatMessage = {
  id: "msg-1",
  role: "user",
  content: "Hello there, this is my first message",
  createdAt: "2026-07-06T18:00:00.000Z",
  status: "complete",
};

beforeEach(() => {
  send.mockReset();
});

describe("createConversationWithFirstMessage", () => {
  it("writes the conversation and first message in one transaction", async () => {
    send.mockResolvedValueOnce({});

    await createConversationWithFirstMessage("user-1", "session-1", userMessage);

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0];
    const [conversationPut, messagePut] = command.input.TransactItems;

    expect(conversationPut.Put.TableName).toBe("TestConversations");
    expect(conversationPut.Put.Item.userId).toBe("user-1");
    expect(conversationPut.Put.Item.sessionId).toBe("session-1");
    expect(conversationPut.Put.Item.title).toBe("Hello there, this is my first message");
    expect(conversationPut.Put.ConditionExpression).toBe("attribute_not_exists(sessionId)");

    expect(messagePut.Put.TableName).toBe("TestMessages");
    expect(messagePut.Put.Item.sessionId).toBe("session-1");
    expect(messagePut.Put.Item.sortKey).toBe("2026-07-06T18:00:00.000Z#msg-1");
    expect(messagePut.Put.Item.role).toBe("user");
    expect(messagePut.Put.Item.content).toBe(userMessage.content);
  });
});

describe("appendUserMessageToConversation", () => {
  it("bumps updatedAt and writes the new message when the conversation exists", async () => {
    send.mockResolvedValueOnce({});

    await appendUserMessageToConversation("user-1", "session-1", userMessage);

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0];
    const [conversationUpdate, messagePut] = command.input.TransactItems;

    expect(conversationUpdate.Update.TableName).toBe("TestConversations");
    expect(conversationUpdate.Update.Key).toEqual({ userId: "user-1", sessionId: "session-1" });
    expect(conversationUpdate.Update.ConditionExpression).toBe("attribute_exists(sessionId)");
    expect(messagePut.Put.Item.content).toBe(userMessage.content);
  });

  it("throws ConversationNotFoundError when the conversation does not belong to this user", async () => {
    const conditionError = new Error("Transaction cancelled");
    conditionError.name = "TransactionCanceledException";
    send.mockRejectedValueOnce(conditionError);

    await expect(
      appendUserMessageToConversation("user-1", "someone-elses-session", userMessage),
    ).rejects.toThrow(ConversationNotFoundError);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test chat-history`
Expected: FAIL — `lib/chat-history.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `lib/chat-history.ts`:

```ts
import "server-only";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, getTableNames } from "@/lib/dynamodb-client";
import { buildConversationTitle } from "@/lib/conversation-title";
import type { ChatMessage } from "@/types/chat";

export class ConversationNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Conversation ${sessionId} was not found for this user`);
    this.name = "ConversationNotFoundError";
  }
}

function toMessageItem(sessionId: string, userId: string, message: ChatMessage) {
  return {
    sessionId,
    sortKey: `${message.createdAt}#${message.id}`,
    userId,
    role: message.role,
    content: message.content,
    status: message.status ?? "complete",
  };
}

export async function createConversationWithFirstMessage(
  userId: string,
  sessionId: string,
  userMessage: ChatMessage,
): Promise<void> {
  const { conversations, messages } = getTableNames();
  const now = new Date().toISOString();

  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: conversations,
            Item: {
              userId,
              sessionId,
              title: buildConversationTitle(userMessage.content),
              createdAt: now,
              updatedAt: now,
            },
            ConditionExpression: "attribute_not_exists(sessionId)",
          },
        },
        {
          Put: {
            TableName: messages,
            Item: toMessageItem(sessionId, userId, userMessage),
          },
        },
      ],
    }),
  );
}

export async function appendUserMessageToConversation(
  userId: string,
  sessionId: string,
  userMessage: ChatMessage,
): Promise<void> {
  const { conversations, messages } = getTableNames();
  const now = new Date().toISOString();

  try {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: conversations,
              Key: { userId, sessionId },
              UpdateExpression: "SET updatedAt = :now",
              ConditionExpression: "attribute_exists(sessionId)",
              ExpressionAttributeValues: { ":now": now },
            },
          },
          {
            Put: {
              TableName: messages,
              Item: toMessageItem(sessionId, userId, userMessage),
            },
          },
        ],
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TransactionCanceledException") {
      throw new ConversationNotFoundError(sessionId);
    }
    throw error;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test chat-history`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/chat-history.ts __tests__/lib/chat-history.test.ts
git commit -m "feat: add conversation creation and continuation to chat-history"
```

---

### Task 5: chat-history.ts — persist the assistant's reply (best-effort)

**Files:**
- Modify: `lib/chat-history.ts`
- Modify: `__tests__/lib/chat-history.test.ts`

**Interfaces:**
- Consumes: same as Task 4, plus `PutCommand` from `@aws-sdk/lib-dynamodb`.
- Produces: `appendAssistantMessage(userId: string, sessionId: string, assistantMessage: ChatMessage): Promise<void>` — never throws; logged-and-swallowed on failure. Consumed by Task 9.

- [ ] **Step 1: Write the failing tests**

In `__tests__/lib/chat-history.test.ts`, update the import from `@/lib/chat-history` to include `appendAssistantMessage`:

```ts
import {
  ConversationNotFoundError,
  appendAssistantMessage,
  appendUserMessageToConversation,
  createConversationWithFirstMessage,
} from "@/lib/chat-history";
```

Then append this to the bottom of the file:

```ts
describe("appendAssistantMessage", () => {
  const assistantMessage: ChatMessage = {
    id: "msg-2",
    role: "assistant",
    content: "Hi! How can I help?",
    createdAt: "2026-07-06T18:00:05.000Z",
    status: "complete",
  };

  it("writes the assistant message", async () => {
    send.mockResolvedValueOnce({});

    await appendAssistantMessage("user-1", "session-1", assistantMessage);

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0];
    expect(command.input.TableName).toBe("TestMessages");
    expect(command.input.Item.sortKey).toBe("2026-07-06T18:00:05.000Z#msg-2");
    expect(command.input.Item.role).toBe("assistant");
  });

  it("swallows and logs errors instead of throwing", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    send.mockRejectedValueOnce(new Error("DynamoDB is unavailable"));

    await expect(
      appendAssistantMessage("user-1", "session-1", assistantMessage),
    ).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test chat-history`
Expected: FAIL — `appendAssistantMessage` is not exported yet.

- [ ] **Step 3: Write the implementation**

In `lib/chat-history.ts`, update the top import line:

```ts
import { PutCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
```

Then append this function to the bottom of the file:

```ts
export async function appendAssistantMessage(
  userId: string,
  sessionId: string,
  assistantMessage: ChatMessage,
): Promise<void> {
  const { messages } = getTableNames();

  try {
    await docClient.send(
      new PutCommand({
        TableName: messages,
        Item: toMessageItem(sessionId, userId, assistantMessage),
      }),
    );
  } catch (error) {
    console.error("Failed to persist assistant message", { sessionId, error });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test chat-history`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/chat-history.ts __tests__/lib/chat-history.test.ts
git commit -m "feat: persist the assistant's reply as a best-effort write"
```

---

### Task 6: chat-history.ts — list conversations and load a conversation's messages

**Files:**
- Modify: `lib/chat-history.ts`
- Modify: `__tests__/lib/chat-history.test.ts`
- Modify: `types/chat.ts`

**Interfaces:**
- Consumes: same as Task 5, plus `GetCommand`, `QueryCommand` from `@aws-sdk/lib-dynamodb`.
- Produces: `ConversationSummary` type (in `@/types/chat`); `listConversationsForUser(userId: string): Promise<ConversationSummary[]>` (sorted desc by `updatedAt`, capped at 30); `loadConversationMessages(userId: string, sessionId: string): Promise<ChatMessage[] | null>` (`null` = not found/not owned). Both consumed by Tasks 7 and 8.

- [ ] **Step 1: Add the ConversationSummary type**

In `types/chat.ts`, append this interface after `SendMessageRequest`:

```ts

export interface ConversationSummary {
  readonly sessionId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

- [ ] **Step 2: Write the failing tests**

In `__tests__/lib/chat-history.test.ts`, update the import from `@/lib/chat-history`:

```ts
import {
  ConversationNotFoundError,
  appendAssistantMessage,
  appendUserMessageToConversation,
  createConversationWithFirstMessage,
  listConversationsForUser,
  loadConversationMessages,
} from "@/lib/chat-history";
```

Then append this to the bottom of the file:

```ts
describe("listConversationsForUser", () => {
  it("returns conversations sorted by updatedAt descending, capped at 30", async () => {
    const items = Array.from({ length: 35 }, (_, index) => ({
      sessionId: `session-${index}`,
      title: `Conversation ${index}`,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: `2026-07-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));
    send.mockResolvedValueOnce({ Items: items });

    const result = await listConversationsForUser("user-1");

    expect(result).toHaveLength(30);
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i - 1].updatedAt >= result[i].updatedAt).toBe(true);
    }
  });
});

describe("loadConversationMessages", () => {
  it("returns null when the conversation isn't owned by this user", async () => {
    send.mockResolvedValueOnce({ Item: undefined });

    const result = await loadConversationMessages("user-1", "not-mine");

    expect(result).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("returns the last messages in chronological order when owned", async () => {
    send
      .mockResolvedValueOnce({ Item: { userId: "user-1", sessionId: "session-1" } })
      .mockResolvedValueOnce({
        Items: [
          {
            sortKey: "2026-07-06T18:00:05.000Z#msg-2",
            role: "assistant",
            content: "Hi! How can I help?",
            status: "complete",
          },
          {
            sortKey: "2026-07-06T18:00:00.000Z#msg-1",
            role: "user",
            content: "Hello there",
            status: "complete",
          },
        ],
      });

    const result = await loadConversationMessages("user-1", "session-1");

    expect(result).toEqual([
      {
        id: "msg-1",
        role: "user",
        content: "Hello there",
        createdAt: "2026-07-06T18:00:00.000Z",
        status: "complete",
      },
      {
        id: "msg-2",
        role: "assistant",
        content: "Hi! How can I help?",
        createdAt: "2026-07-06T18:00:05.000Z",
        status: "complete",
      },
    ]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test chat-history`
Expected: FAIL — `listConversationsForUser` and `loadConversationMessages` are not exported yet.

- [ ] **Step 4: Write the implementation**

In `lib/chat-history.ts`, update the top two import lines:

```ts
import { GetCommand, PutCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, getTableNames } from "@/lib/dynamodb-client";
import { buildConversationTitle } from "@/lib/conversation-title";
import type { ChatMessage, ConversationSummary } from "@/types/chat";
```

Then append these to the bottom of the file:

```ts
const MAX_CONVERSATIONS = 30;

export async function listConversationsForUser(userId: string): Promise<ConversationSummary[]> {
  const { conversations } = getTableNames();

  const result = await docClient.send(
    new QueryCommand({
      TableName: conversations,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    }),
  );

  const items = (result.Items ?? []) as ConversationSummary[];

  return items
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_CONVERSATIONS);
}

const MAX_MESSAGES = 50;

interface MessageItem {
  readonly sortKey: string;
  readonly role: ChatMessage["role"];
  readonly content: string;
  readonly status?: ChatMessage["status"];
}

function splitSortKey(sortKey: string): { createdAt: string; id: string } {
  const separatorIndex = sortKey.indexOf("#");
  return {
    createdAt: sortKey.slice(0, separatorIndex),
    id: sortKey.slice(separatorIndex + 1),
  };
}

export async function loadConversationMessages(
  userId: string,
  sessionId: string,
): Promise<ChatMessage[] | null> {
  const { conversations, messages } = getTableNames();

  const ownership = await docClient.send(
    new GetCommand({
      TableName: conversations,
      Key: { userId, sessionId },
    }),
  );

  if (!ownership.Item) {
    return null;
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: messages,
      KeyConditionExpression: "sessionId = :sessionId",
      ExpressionAttributeValues: { ":sessionId": sessionId },
      ScanIndexForward: false,
      Limit: MAX_MESSAGES,
    }),
  );

  const items = (result.Items ?? []) as MessageItem[];

  return items
    .slice()
    .reverse()
    .map((item) => {
      const { createdAt, id } = splitSortKey(item.sortKey);
      return {
        id,
        role: item.role,
        content: item.content,
        createdAt,
        status: item.status,
      };
    });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test chat-history`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/chat-history.ts __tests__/lib/chat-history.test.ts types/chat.ts
git commit -m "feat: add conversation listing and message loading to chat-history"
```

---

### Task 7: API route — GET /api/conversations

**Files:**
- Create: `app/api/conversations/route.ts`
- Test: `__tests__/app/api/conversations/route.test.ts`

**Interfaces:**
- Consumes: `getSession()` from `@/lib/session`; `listConversationsForUser(userId: string): Promise<ConversationSummary[]>` from `@/lib/chat-history` (Task 6).
- Produces: `GET` handler returning `{ conversations: ConversationSummary[] }` (200) or `{ error: string }` (401). Consumed by Task 13 (`chat-shell.tsx`).

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/api/conversations/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/chat-history", () => ({ listConversationsForUser: vi.fn() }));

import { getSession } from "@/lib/session";
import { listConversationsForUser } from "@/lib/chat-history";
import { GET } from "@/app/api/conversations/route";

const mockGetSession = getSession as unknown as ReturnType<typeof vi.fn>;
const mockListConversations = listConversationsForUser as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockGetSession.mockReset();
  mockListConversations.mockReset();
});

describe("GET /api/conversations", () => {
  it("returns 401 when there is no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockListConversations).not.toHaveBeenCalled();
  });

  it("returns the user's conversations when authenticated", async () => {
    mockGetSession.mockResolvedValueOnce({ userId: "user-1", email: "a@b.com" });
    mockListConversations.mockResolvedValueOnce([
      {
        sessionId: "s1",
        title: "Hello",
        createdAt: "2026-07-06T00:00:00.000Z",
        updatedAt: "2026-07-06T00:00:00.000Z",
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockListConversations).toHaveBeenCalledWith("user-1");
    expect(body).toEqual({
      conversations: [
        {
          sessionId: "s1",
          title: "Hello",
          createdAt: "2026-07-06T00:00:00.000Z",
          updatedAt: "2026-07-06T00:00:00.000Z",
        },
      ],
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test conversations/route`
Expected: FAIL — `app/api/conversations/route.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `app/api/conversations/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listConversationsForUser } from "@/lib/chat-history";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await listConversationsForUser(session.userId);
  return NextResponse.json({ conversations });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test conversations/route`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/conversations/route.ts __tests__/app/api/conversations/route.test.ts
git commit -m "feat: add GET /api/conversations endpoint"
```

---

### Task 8: API route — GET /api/conversations/:sessionId/messages

**Files:**
- Create: `app/api/conversations/[sessionId]/messages/route.ts`
- Test: `__tests__/app/api/conversations/[sessionId]/messages/route.test.ts`

**Interfaces:**
- Consumes: `getSession()` from `@/lib/session`; `loadConversationMessages(userId: string, sessionId: string): Promise<ChatMessage[] | null>` from `@/lib/chat-history` (Task 6).
- Produces: `GET` handler returning `{ messages: ChatMessage[] }` (200), `{ error: string }` (401 or 404). Consumed by Task 13 (`chat-shell.tsx`).

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/api/conversations/[sessionId]/messages/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/chat-history", () => ({ loadConversationMessages: vi.fn() }));

import { getSession } from "@/lib/session";
import { loadConversationMessages } from "@/lib/chat-history";
import { GET } from "@/app/api/conversations/[sessionId]/messages/route";

const mockGetSession = getSession as unknown as ReturnType<typeof vi.fn>;
const mockLoadMessages = loadConversationMessages as unknown as ReturnType<typeof vi.fn>;

function makeParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

beforeEach(() => {
  mockGetSession.mockReset();
  mockLoadMessages.mockReset();
});

describe("GET /api/conversations/:sessionId/messages", () => {
  it("returns 401 when there is no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const response = await GET(
      new Request("http://localhost/api/conversations/s1/messages"),
      makeParams("s1"),
    );

    expect(response.status).toBe(401);
    expect(mockLoadMessages).not.toHaveBeenCalled();
  });

  it("returns 404 when the conversation isn't found or owned", async () => {
    mockGetSession.mockResolvedValueOnce({ userId: "user-1", email: "a@b.com" });
    mockLoadMessages.mockResolvedValueOnce(null);

    const response = await GET(
      new Request("http://localhost/api/conversations/s1/messages"),
      makeParams("s1"),
    );

    expect(response.status).toBe(404);
  });

  it("returns the conversation's messages when found", async () => {
    mockGetSession.mockResolvedValueOnce({ userId: "user-1", email: "a@b.com" });
    mockLoadMessages.mockResolvedValueOnce([
      { id: "msg-1", role: "user", content: "Hi", createdAt: "2026-07-06T00:00:00.000Z", status: "complete" },
    ]);

    const response = await GET(
      new Request("http://localhost/api/conversations/s1/messages"),
      makeParams("s1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockLoadMessages).toHaveBeenCalledWith("user-1", "s1");
    expect(body.messages).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test "conversations/\[sessionId\]"`
Expected: FAIL — the route file does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `app/api/conversations/[sessionId]/messages/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadConversationMessages } from "@/lib/chat-history";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  const messages = await loadConversationMessages(session.userId, sessionId);

  if (messages === null) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({ messages });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test "conversations/\[sessionId\]"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "app/api/conversations/[sessionId]/messages/route.ts" "__tests__/app/api/conversations/[sessionId]/messages/route.test.ts"
git commit -m "feat: add GET /api/conversations/:sessionId/messages endpoint"
```

---

### Task 9: Wire persistence into POST /api/chat

Adds conversation/message persistence around the existing pass-through streaming logic in `app/api/chat/route.ts`, without changing its streaming behavior. Uses `after()` from `next/server` to persist the assistant's reply once the response has fully streamed, since the full text is only known once streaming finishes.

**Files:**
- Modify: `app/api/chat/route.ts`
- Test: `__tests__/app/api/chat/route.test.ts`

**Interfaces:**
- Consumes: `createChatMessage(role, content): ChatMessage` from `@/lib/chat-message` (existing); `ConversationNotFoundError`, `createConversationWithFirstMessage`, `appendUserMessageToConversation`, `appendAssistantMessage` from `@/lib/chat-history` (Tasks 4-5); `after` from `next/server`.
- Produces: unchanged public response shape (still a streamed `text/plain` body with an `X-Conversation-Id` header) — persistence is additive and invisible to the client except for the new 404 case on an ownership mismatch.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/app/api/chat/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-bedrock-agentcore", () => ({
  BedrockAgentCoreClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
  InvokeAgentRuntimeCommand: vi.fn((input: unknown) => ({ input })),
}));

vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));

vi.mock("@/lib/chat-history", () => ({
  ConversationNotFoundError: class ConversationNotFoundError extends Error {},
  createConversationWithFirstMessage: vi.fn(),
  appendUserMessageToConversation: vi.fn(),
  appendAssistantMessage: vi.fn(),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: vi.fn((callback: () => unknown) => callback()),
  };
});

import { getSession } from "@/lib/session";
import {
  ConversationNotFoundError,
  appendAssistantMessage,
  appendUserMessageToConversation,
  createConversationWithFirstMessage,
} from "@/lib/chat-history";
import { POST } from "@/app/api/chat/route";

const mockGetSession = getSession as unknown as ReturnType<typeof vi.fn>;
const mockCreateConversation = createConversationWithFirstMessage as unknown as ReturnType<typeof vi.fn>;
const mockAppendUserMessage = appendUserMessageToConversation as unknown as ReturnType<typeof vi.fn>;
const mockAppendAssistantMessage = appendAssistantMessage as unknown as ReturnType<typeof vi.fn>;

function sseStreamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  });
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readAllText(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

beforeEach(() => {
  mockGetSession.mockReset();
  mockCreateConversation.mockReset();
  mockAppendUserMessage.mockReset();
  mockAppendAssistantMessage.mockReset();
  mockSend.mockReset();
  mockGetSession.mockResolvedValue({ userId: "user-1", email: "a@b.com" });
});

describe("POST /api/chat persistence", () => {
  it("creates a new conversation and persists the assistant reply for a fresh chat", async () => {
    mockCreateConversation.mockResolvedValueOnce(undefined);
    mockSend.mockResolvedValueOnce({
      contentType: "text/event-stream",
      response: { transformToWebStream: () => sseStreamFromChunks(['data: "Hi there"\n\n']) },
    });

    const response = await POST(jsonRequest({ message: "Hello" }));
    const text = await readAllText(response.body);

    expect(response.status).toBe(200);
    expect(text).toBe("Hi there");
    expect(mockCreateConversation).toHaveBeenCalledWith(
      "user-1",
      response.headers.get("X-Conversation-Id"),
      expect.objectContaining({ role: "user", content: "Hello" }),
    );
    expect(mockAppendAssistantMessage).toHaveBeenCalledWith(
      "user-1",
      response.headers.get("X-Conversation-Id"),
      expect.objectContaining({ role: "assistant", content: "Hi there" }),
    );
  });

  it("continues an existing conversation by appending the user message", async () => {
    mockAppendUserMessage.mockResolvedValueOnce(undefined);
    mockSend.mockResolvedValueOnce({
      contentType: "text/event-stream",
      response: { transformToWebStream: () => sseStreamFromChunks(['data: "Sure"\n\n']) },
    });

    const response = await POST(jsonRequest({ conversationId: "session-1", message: "Continue" }));
    await readAllText(response.body);

    expect(mockAppendUserMessage).toHaveBeenCalledWith(
      "user-1",
      "session-1",
      expect.objectContaining({ role: "user", content: "Continue" }),
    );
    expect(response.headers.get("X-Conversation-Id")).toBe("session-1");
  });

  it("returns 404 when continuing a conversation that doesn't belong to this user", async () => {
    mockAppendUserMessage.mockRejectedValueOnce(new ConversationNotFoundError("session-1"));

    const response = await POST(jsonRequest({ conversationId: "session-1", message: "Continue" }));

    expect(response.status).toBe(404);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("keeps the persisted user message even if the agent invocation fails", async () => {
    mockCreateConversation.mockResolvedValueOnce(undefined);
    mockSend.mockRejectedValueOnce(new Error("AgentCore unreachable"));

    const response = await POST(jsonRequest({ message: "Hello" }));

    expect(response.status).toBe(502);
    expect(mockCreateConversation).toHaveBeenCalled();
    expect(mockAppendAssistantMessage).not.toHaveBeenCalled();
  });

  it("logs and continues when persisting the user message fails for a reason other than ownership", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateConversation.mockRejectedValueOnce(new Error("DynamoDB unavailable"));
    mockSend.mockResolvedValueOnce({
      contentType: "text/event-stream",
      response: { transformToWebStream: () => sseStreamFromChunks(['data: "Hi there"\n\n']) },
    });

    const response = await POST(jsonRequest({ message: "Hello" }));
    await readAllText(response.body);

    expect(response.status).toBe(200);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test app/api/chat/route`
Expected: FAIL — persistence isn't wired in yet, so `mockCreateConversation`/`mockAppendUserMessage`/`mockAppendAssistantMessage` are never called and the 404 case doesn't exist.

- [ ] **Step 3: Update the imports in app/api/chat/route.ts**

Replace the top import block (currently lines 1-6):

```ts
import { NextResponse, after } from "next/server";
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import { getSession } from "@/lib/session";
import { createChatMessage } from "@/lib/chat-message";
import {
  ConversationNotFoundError,
  appendAssistantMessage,
  appendUserMessageToConversation,
  createConversationWithFirstMessage,
} from "@/lib/chat-history";
```

- [ ] **Step 4: Make pipeEventStream return the accumulated text**

Replace the `pipeEventStream` function (currently lines 93-126):

```ts
async function pipeEventStream(
  webStream: ReadableStream<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<string> {
  const reader = webStream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let accumulated = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const text = decodeSseFrame(frame);
      if (text) {
        controller.enqueue(encoder.encode(text));
        accumulated += text;
      }
    }
  }

  if (buffer.trim()) {
    const text = decodeSseFrame(buffer);
    if (text) {
      controller.enqueue(encoder.encode(text));
      accumulated += text;
    }
  }

  return accumulated;
}
```

- [ ] **Step 5: Wire persistence into the POST handler**

Replace the entire `POST` function (currently lines 208-301):

```ts
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let conversationId: string | undefined;
  let message: string;
  try {
    ({ conversationId, message } = parseChatRequest(await request.json()));
  } catch (error) {
    if (error instanceof TypeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : "Invalid request body";
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  // conversationId doubles as the AgentCore session id, so a fresh chat and a
  // continued one share the same identifier end to end.
  const sessionId = conversationId ?? crypto.randomUUID();
  const userMessage = createChatMessage("user", message);

  // Persisted before the agent is ever invoked, so the message survives even
  // if the agent call below fails. An ownership mismatch is the one failure
  // that's surfaced to the client - anything else is logged and swallowed,
  // matching the "best-effort" persistence policy in the design doc.
  try {
    if (conversationId) {
      await appendUserMessageToConversation(session.userId, sessionId, userMessage);
    } else {
      await createConversationWithFirstMessage(session.userId, sessionId, userMessage);
    }
  } catch (error) {
    if (error instanceof ConversationNotFoundError) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    console.error("Failed to persist user message", { sessionId, error });
  }

  // This call only reserves the connection to the agent - for a streaming
  // agent, invokeAgentCore/invokeLocalAgent resolve as soon as the *first*
  // byte is available, not when the whole reply is done. Failures here (bad
  // auth, agent unreachable, empty response) happen before we've committed to
  // a 200, so they can still be reported as a normal JSON error response.
  let invocation: AgentInvocation;
  try {
    invocation = LOCAL_AGENT_URL
      ? await invokeLocalAgent(message, sessionId, LOCAL_AGENT_URL)
      : await invokeAgentCore(message, sessionId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }

  // The agent's Content-Type is the single signal for which shape it sent:
  // text/event-stream once its entrypoint yields chunks, application/json
  // (or plain text) while it still returns one value. Everything past this
  // point exists to make both cases look identical to the browser.
  const isEventStream = invocation.contentType.includes("event-stream");

  // From here on we're building our *own* response body, decoupled from how
  // the agent replied. Once this ReadableStream is handed to `new Response`
  // below, any bytes enqueued into `controller` are flushed to the browser
  // immediately - that's what turns "the agent produced a word" into "the
  // user sees a word appear," rather than waiting for `POST` to return.
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantContent = "";
      try {
        if (isEventStream) {
          assistantContent = await pipeEventStream(invocation.bodyStream, controller);
        } else {
          // Agent isn't streaming yet (still returns one JSON/text payload) -
          // buffer it and deliver as a single chunk so the client code path
          // is identical either way. Once the Python entrypoint switches to
          // `yield`, contentType flips to event-stream and this branch stops
          // being hit - no client-side change needed when that happens.
          const raw = await readWebStreamToString(invocation.bodyStream);
          let content = raw;
          try {
            const parsed = JSON.parse(raw);
            if (typeof parsed === "string") {
              content = parsed;
            }
          } catch {
            // response is plain text, use as-is
          }
          controller.enqueue(new TextEncoder().encode(content));
          assistantContent = content;
        }
      } catch (error) {
        // The 200 status and headers below are already sent by this point,
        // so a failure here can't become a JSON error response - controller.error()
        // aborts the fetch body on the client, which the UI treats as a send failure.
        controller.error(error);
        return;
      }
      controller.close();

      // Deferred until after the response is fully sent - `after()` keeps
      // this write alive even on platforms that would otherwise freeze/tear
      // down execution the instant the HTTP response finishes, which a bare
      // fire-and-forget promise here would be vulnerable to.
      after(async () => {
        const assistantMessage = createChatMessage("assistant", assistantContent);
        await appendAssistantMessage(session.userId, sessionId, assistantMessage);
      });
    },
  });

  // conversationId now travels as a header instead of in a JSON body, since
  // the body itself is the raw reply text (streamed or not) - there's no
  // JSON envelope left to put it in.
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": sessionId,
      "Cache-Control": "no-store",
    },
  });
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test app/api/chat/route`
Expected: PASS (5 tests).

- [ ] **Step 7: Run the full test suite to check for regressions**

Run: `pnpm test`
Expected: all test files PASS.

- [ ] **Step 8: Commit**

```bash
git add app/api/chat/route.ts __tests__/app/api/chat/route.test.ts
git commit -m "feat: persist conversations and messages in POST /api/chat"
```

---

### Task 10: chat-api.ts — surface the conversation id as soon as it's known

**Files:**
- Modify: `lib/chat-api.ts`
- Test: `__tests__/lib/chat-api.test.ts`

**Interfaces:**
- Produces: `SendMessageOptions.onConversationId?: (conversationId: string) => void`, invoked as soon as `fetch()`'s response headers arrive (before the body finishes streaming). Consumed by Task 11 (`main-chat.tsx`).

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/chat-api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { chatApiClient } from "@/lib/chat-api";

function streamingResponse(conversationId: string, chunks: string[]): Response {
  const encoder = new TextEncoder();
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  });

  return new Response(body, {
    status: 200,
    headers: { "X-Conversation-Id": conversationId },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RestChatApiClient.sendMessage", () => {
  it("calls onConversationId before the body finishes streaming", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn().mockResolvedValue(streamingResponse("session-1", ["Hel", "lo"]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatApiClient.sendMessage(
      { message: "Hi" },
      {
        onConversationId: (id) => calls.push(`id:${id}`),
        onChunk: (chunk) => calls.push(`chunk:${chunk}`),
      },
    );

    expect(result).toEqual({ conversationId: "session-1" });
    expect(calls[0]).toBe("id:session-1");
    expect(calls.slice(1)).toEqual(["chunk:Hel", "chunk:lo"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test chat-api`
Expected: FAIL — `onConversationId` doesn't exist on `SendMessageOptions` yet.

- [ ] **Step 3: Write the implementation**

Replace the `SendMessageOptions` interface (currently `lib/chat-api.ts` lines 6-8):

```ts
export interface SendMessageOptions {
  readonly onChunk?: (chunk: string) => void;
  readonly onConversationId?: (conversationId: string) => void;
}
```

Then, inside `RestChatApiClient.sendMessage`, add the callback invocation right after the existing conversation id check (currently lines 64-67):

```ts
    const conversationId = response.headers.get("X-Conversation-Id");
    if (!conversationId) {
      throw new Error("Chat API response is missing the conversation id");
    }

    // Fired as soon as headers arrive - well before the body finishes
    // streaming - so the sidebar can show a brand-new conversation while the
    // reply is still coming in, instead of waiting for the full turn to end.
    options?.onConversationId?.(conversationId);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test chat-api`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add lib/chat-api.ts __tests__/lib/chat-api.test.ts
git commit -m "feat: surface the conversation id as soon as it's known"
```

---

### Task 11: main-chat.tsx — accept a conversation to continue, react to the id immediately

**Files:**
- Modify: `components/main-chat.tsx`
- Test: `__tests__/components/main-chat.test.tsx`

**Interfaces:**
- Consumes: `onConversationId` option from `@/lib/chat-api` (Task 10).
- Produces: `MainChatProps` gains `conversationId?: string` and `initialMessages?: ChatMessage[]`, both consumed by Task 13 (`chat-shell.tsx`). `onSessionChange` now fires as soon as the conversation id is known, not after the full reply streams in.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/main-chat.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/chat-api", () => ({
  chatApiClient: { sendMessage: vi.fn() },
}));

import { chatApiClient } from "@/lib/chat-api";
import { MainChat } from "@/components/main-chat";

const mockSendMessage = chatApiClient.sendMessage as unknown as ReturnType<typeof vi.fn>;

describe("MainChat", () => {
  it("reports the conversation id as soon as it's known, before the send resolves", async () => {
    let resolveSend: (() => void) | undefined;
    mockSendMessage.mockImplementationOnce((_request, options) => {
      options?.onConversationId?.("new-session-id");
      return new Promise<{ conversationId: string }>((resolve) => {
        resolveSend = () => resolve({ conversationId: "new-session-id" });
      });
    });

    const handleSessionChange = vi.fn();
    render(
      <MainChat
        isSidebarVisible
        onSessionChange={handleSessionChange}
        onTogglePanel={() => {}}
        shouldShowHeader
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ask the assistant something."), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(handleSessionChange).toHaveBeenCalledWith({
      conversationId: "new-session-id",
      sessionTitle: "Hello",
    });

    resolveSend?.();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test main-chat`
Expected: FAIL — `onSessionChange` currently only fires after `sendMessage` resolves, so it hasn't been called yet at the assertion point.

- [ ] **Step 3: Write the implementation**

Add these two fields to `MainChatProps` (currently `components/main-chat.tsx` lines 38-43):

```ts
interface MainChatProps {
  readonly conversationId?: string;
  readonly initialMessages?: ChatMessage[];
  readonly isSidebarVisible: boolean;
  readonly onSessionChange: (session: { conversationId?: string; sessionTitle?: string }) => void;
  readonly onTogglePanel: () => void;
  readonly shouldShowHeader: boolean;
}
```

Update the component's opening lines to destructure and use the new props (currently lines 175-186):

```ts
export function MainChat({
  conversationId: initialConversationId,
  initialMessages,
  isSidebarVisible,
  onSessionChange,
  onTogglePanel,
  shouldShowHeader,
}: Readonly<MainChatProps>) {
  const transcriptRef = useRef<HTMLElement | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>();
```

Replace the body of `handleSubmit` from where `assistantMessage` is declared through the end of the function (currently lines 213-277):

```ts
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    setDraft("");
    setError(undefined);
    setIsSending(true);
    setMessages((currentMessages) => [...currentMessages, userMessage, assistantMessage]);

    // Accumulated outside React state because chunks can arrive faster than
    // re-renders settle; state always gets the up-to-date full string built
    // from this, rather than each update depending on the previous render's
    // `message.content` (which could be stale mid-stream).
    let assistantContent = "";

    function appendChunk(chunk: string) {
      assistantContent += chunk;
      setMessages((currentMessages) =>
        updateMessageById(currentMessages, assistantMessageId, withContent(assistantContent)),
      );
    }

    // Fires as soon as the response headers arrive - not once the whole
    // reply has streamed in - so a brand-new conversation shows up in the
    // sidebar right away instead of only once the assistant finishes
    // replying.
    function handleConversationId(nextConversationId: string) {
      setConversationId(nextConversationId);
      onSessionChange({
        conversationId: nextConversationId,
        sessionTitle: nextSessionTitle,
      });
    }

    try {
      await chatApiClient.sendMessage(
        { conversationId, message: trimmedDraft },
        { onChunk: appendChunk, onConversationId: handleConversationId },
      );

      setMessages((currentMessages) =>
        updateMessageById(currentMessages, assistantMessageId, withStatus("complete")),
      );
    } catch (submitError) {
      console.error("Failed to send chat message", submitError);
      const message =
        submitError instanceof Error
          ? submitError.message
          : "The message could not be sent. Retry once the backend is available.";
      setError(message);
      // Drop the placeholder/partial bubble on failure rather than leaving a
      // truncated reply in the transcript - the error banner is the record
      // of what happened, matching how a fully-failed send behaved before.
      setMessages((currentMessages) => removeMessageById(currentMessages, assistantMessageId));
    } finally {
      setIsSending(false);
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test main-chat`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add components/main-chat.tsx __tests__/components/main-chat.test.tsx
git commit -m "feat: let MainChat load a conversation and react to its id immediately"
```

---

### Task 12: chat-sidebar.tsx — render the conversation list

Built and tested standalone (a plain `conversations` array prop) so Task 13 can wire real data into it without any prop-shape mismatch in between.

**Files:**
- Modify: `components/chat-sidebar.tsx`
- Test: `__tests__/components/chat-sidebar.test.tsx`

**Interfaces:**
- Consumes: `ConversationSummary` from `@/types/chat` (Task 6).
- Produces: `ChatSidebarProps` gains `conversations: ConversationSummary[]`, `onSelectConversation: (sessionId: string) => void`, `onNewChat: () => void`; drops `sessionTitle` (no longer displayed — the selected list item's highlight now carries that information). Consumed by Task 13 (`chat-shell.tsx`).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/chat-sidebar.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatSidebar } from "@/components/chat-sidebar";

const conversations = [
  {
    sessionId: "s1",
    title: "First chat",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  },
  {
    sessionId: "s2",
    title: "Second chat",
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
  },
];

describe("ChatSidebar", () => {
  it("shows an empty state when there are no conversations", () => {
    render(
      <ChatSidebar
        conversations={[]}
        onSelectConversation={() => {}}
        onNewChat={() => {}}
        isVisible
        cognitoLogoutUrl="https://example.com/logout"
        onTogglePanel={() => {}}
      />,
    );

    expect(screen.getByText("No conversations yet. Send a message to start one.")).toBeInTheDocument();
  });

  it("renders each conversation and calls onSelectConversation when clicked", () => {
    const handleSelect = vi.fn();
    render(
      <ChatSidebar
        conversations={conversations}
        conversationId="s1"
        onSelectConversation={handleSelect}
        onNewChat={() => {}}
        isVisible
        cognitoLogoutUrl="https://example.com/logout"
        onTogglePanel={() => {}}
      />,
    );

    expect(screen.getByText("First chat")).toBeInTheDocument();
    expect(screen.getByText("Second chat")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Second chat"));
    expect(handleSelect).toHaveBeenCalledWith("s2");
  });

  it("calls onNewChat when the New chat button is clicked", () => {
    const handleNewChat = vi.fn();
    render(
      <ChatSidebar
        conversations={conversations}
        onSelectConversation={() => {}}
        onNewChat={handleNewChat}
        isVisible
        cognitoLogoutUrl="https://example.com/logout"
        onTogglePanel={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(handleNewChat).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test chat-sidebar`
Expected: FAIL — `ChatSidebar` doesn't accept `conversations`/`onSelectConversation`/`onNewChat` yet.

- [ ] **Step 3: Write the implementation**

Replace the full contents of `components/chat-sidebar.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { ChatHeaderControls } from "@/components/chat-header-controls";
import { SignOutButton } from "@/components/sign-out-button";
import type { ConversationSummary } from "@/types/chat";

function SparkIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path d="M12 3.5c1.2 2.8 2.7 4.3 5.5 5.5-2.8 1.2-4.3 2.7-5.5 5.5-1.2-2.8-2.7-4.3-5.5-5.5 2.8-1.2 4.3-2.7 5.5-5.5Z" />
      <path d="M6.5 13.5c.8 1.8 1.7 2.7 3.5 3.5-1.8.8-2.7 1.7-3.5 3.5-.8-1.8-1.7-2.7-3.5-3.5 1.8-.8 2.7-1.7 3.5-3.5Z" />
      <path d="M17.5 13.5c.6 1.4 1.6 2.4 3 3-.9.4-1.6.9-2.1 1.5-.5.6-.8 1.2-.9 1.9-.2-.8-.5-1.4-.9-1.9-.5-.6-1.2-1.1-2.1-1.5 1.4-.6 2.4-1.6 3-3Z" />
    </svg>
  );
}

interface SidebarInfoCardProps {
  readonly title: string;
  readonly children: ReactNode;
}

function SidebarInfoCard({ title, children }: SidebarInfoCardProps) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/4 px-4 py-4">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">{title}</p>
      {children}
    </div>
  );
}

function formatConversationTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

interface ConversationListProps {
  readonly conversations: ConversationSummary[];
  readonly selectedConversationId?: string;
  readonly onSelectConversation: (sessionId: string) => void;
}

function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
}: Readonly<ConversationListProps>) {
  if (conversations.length === 0) {
    return (
      <p className="px-2 text-sm leading-6 text-stone-500">
        No conversations yet. Send a message to start one.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {conversations.map((conversation) => {
        const isSelected = conversation.sessionId === selectedConversationId;
        return (
          <li key={conversation.sessionId}>
            <button
              className={`flex w-full flex-col gap-1 rounded-2xl px-4 py-3 text-left transition ${
                isSelected ? "bg-white/12 text-white" : "text-stone-300 hover:bg-white/6"
              }`}
              type="button"
              onClick={() => onSelectConversation(conversation.sessionId)}
            >
              <span className="truncate text-sm font-medium">{conversation.title}</span>
              <span className="text-xs uppercase tracking-[0.14em] text-stone-500">
                {formatConversationTimestamp(conversation.updatedAt)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface ChatSidebarProps {
  readonly conversationId?: string;
  readonly conversations: ConversationSummary[];
  readonly onSelectConversation: (sessionId: string) => void;
  readonly onNewChat: () => void;
  readonly isVisible: boolean;
  readonly cognitoLogoutUrl: string;
  readonly onTogglePanel: () => void;
}

export function ChatSidebar({
  conversationId,
  conversations,
  onSelectConversation,
  onNewChat,
  isVisible,
  cognitoLogoutUrl,
  onTogglePanel,
}: Readonly<ChatSidebarProps>) {
  return (
    <aside
      id="chat-side-panel"
      className={`${isVisible ? "flex" : "hidden"} min-h-full w-full flex-col border-r border-white/6 bg-[#242424] px-4 py-4 text-stone-100 lg:w-[300px] lg:min-w-[300px]`}
    >
      <div className="flex h-12 items-center gap-3 px-2 text-stone-500">
        <div className="flex items-center gap-4">
          <ChatHeaderControls isSidebarVisible={isVisible} onTogglePanel={onTogglePanel} />
        </div>
      </div>

      <button
        className="mt-5 flex w-full items-center gap-4 rounded-2xl bg-white/8 px-4 py-4 text-left text-[1.05rem] font-semibold text-white transition hover:bg-white/12"
        type="button"
        onClick={onNewChat}
      >
        <span className="text-stone-100">
          <SparkIcon />
        </span>
        <span>New chat</span>
      </button>

      <nav className="mt-5 flex-1 space-y-1 overflow-y-auto">
        <ConversationList
          conversations={conversations}
          selectedConversationId={conversationId}
          onSelectConversation={onSelectConversation}
        />
      </nav>

      <div className="mt-auto pt-4 border-t border-white/6">
        <SignOutButton cognitoLogoutUrl={cognitoLogoutUrl} />
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test chat-sidebar`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/chat-sidebar.tsx __tests__/components/chat-sidebar.test.tsx
git commit -m "feat: render the conversation list and New chat button in the sidebar"
```

---

### Task 13: chat-shell.tsx — own the conversation list and wire everything together

**Files:**
- Modify: `components/chat-shell.tsx`
- Test: `__tests__/components/chat-shell.test.tsx`

**Interfaces:**
- Consumes: `ChatSidebar` (Task 12) with its new props; `MainChat` (Task 11) with its new `conversationId`/`initialMessages` props; `GET /api/conversations` (Task 7); `GET /api/conversations/:sessionId/messages` (Task 8).
- Produces: the fully wired feature — no further tasks depend on this one.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/chat-shell.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/chat-sidebar", () => ({
  ChatSidebar: (props: {
    conversations: { sessionId: string; title: string }[];
    onSelectConversation: (sessionId: string) => void;
    onNewChat: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => props.onSelectConversation("s1")}>
        select-s1
      </button>
      <button type="button" onClick={props.onNewChat}>
        new-chat
      </button>
      <ul>
        {props.conversations.map((conversation) => (
          <li key={conversation.sessionId}>{conversation.title}</li>
        ))}
      </ul>
    </div>
  ),
}));

vi.mock("@/components/main-chat", () => ({
  MainChat: (props: { conversationId?: string; initialMessages?: { content: string }[] }) => (
    <div>
      <span>conversationId:{props.conversationId ?? "none"}</span>
      <span>messageCount:{props.initialMessages?.length ?? 0}</span>
    </div>
  ),
}));

import { ChatShell } from "@/components/chat-shell";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/api/conversations") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              conversations: [
                {
                  sessionId: "s1",
                  title: "First chat",
                  createdAt: "2026-07-01T00:00:00.000Z",
                  updatedAt: "2026-07-01T00:00:00.000Z",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url === "/api/conversations/s1/messages") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              messages: [
                {
                  id: "m1",
                  role: "user",
                  content: "Hi",
                  createdAt: "2026-07-01T00:00:00.000Z",
                  status: "complete",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch to ${url}`));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChatShell", () => {
  it("loads the conversation list on mount", async () => {
    render(<ChatShell cognitoLogoutUrl="https://example.com/logout" />);

    expect(await screen.findByText("First chat")).toBeInTheDocument();
  });

  it("loads a conversation's messages when selected from the sidebar", async () => {
    render(<ChatShell cognitoLogoutUrl="https://example.com/logout" />);
    await screen.findByText("First chat");

    fireEvent.click(screen.getByText("select-s1"));

    expect(await screen.findByText("conversationId:s1")).toBeInTheDocument();
    expect(await screen.findByText("messageCount:1")).toBeInTheDocument();
  });

  it("resets to a fresh chat when New chat is clicked", async () => {
    render(<ChatShell cognitoLogoutUrl="https://example.com/logout" />);
    await screen.findByText("First chat");
    fireEvent.click(screen.getByText("select-s1"));
    await screen.findByText("conversationId:s1");

    fireEvent.click(screen.getByText("new-chat"));

    expect(await screen.findByText("conversationId:none")).toBeInTheDocument();
    expect(await screen.findByText("messageCount:0")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test chat-shell`
Expected: FAIL — `ChatShell` doesn't fetch conversations or wire selection/new-chat yet.

- [ ] **Step 3: Write the implementation**

Replace the full contents of `components/chat-shell.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";
import { MainChat } from "@/components/main-chat";
import {
  getChatPaneVisibilityClass,
  getShellLayoutClass,
  getSidebarVisible,
} from "@/lib/chat-layout";
import type { ChatMessage, ConversationSummary } from "@/types/chat";

interface ChatShellProps {
  readonly cognitoLogoutUrl: string;
}

function upsertConversation(
  conversations: ConversationSummary[],
  sessionId: string,
  title: string,
): ConversationSummary[] {
  const now = new Date().toISOString();
  const existing = conversations.find((conversation) => conversation.sessionId === sessionId);
  const updated: ConversationSummary = existing
    ? { ...existing, updatedAt: now }
    : { sessionId, title, createdAt: now, updatedAt: now };
  const withoutExisting = conversations.filter(
    (conversation) => conversation.sessionId !== sessionId,
  );

  return [updated, ...withoutExisting];
}

export function ChatShell({ cognitoLogoutUrl }: ChatShellProps) {
  const [conversationId, setConversationId] = useState<string>();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationMessages, setConversationMessages] = useState<ChatMessage[]>();
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [isDesktopPanelVisible, setIsDesktopPanelVisible] = useState(true);
  const [mobilePane, setMobilePane] = useState<"chat" | "panel">("chat");

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia("(min-width: 1024px)");

    function updateViewportMode() {
      setIsDesktopViewport(mediaQuery.matches);
    }

    updateViewportMode();
    mediaQuery.addEventListener("change", updateViewportMode);

    return () => {
      mediaQuery.removeEventListener("change", updateViewportMode);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      const response = await fetch("/api/conversations");
      if (!response.ok || cancelled) {
        return;
      }
      const { conversations: loaded } = (await response.json()) as {
        conversations: ConversationSummary[];
      };
      if (!cancelled) {
        setConversations(loaded);
      }
    }

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, []);

  function handlePanelToggle() {
    if (isDesktopViewport) {
      setIsDesktopPanelVisible((currentValue) => !currentValue);
      return;
    }

    setMobilePane((currentValue) => (currentValue === "chat" ? "panel" : "chat"));
  }

  function handleSessionChange({
    conversationId: nextConversationId,
    sessionTitle: nextSessionTitle,
  }: {
    conversationId?: string;
    sessionTitle?: string;
  }) {
    setConversationId(nextConversationId);
    if (nextConversationId) {
      setConversations((currentConversations) =>
        upsertConversation(currentConversations, nextConversationId, nextSessionTitle ?? ""),
      );
    }
  }

  async function handleSelectConversation(sessionId: string) {
    const response = await fetch(`/api/conversations/${sessionId}/messages`);
    if (!response.ok) {
      return;
    }
    const { messages } = (await response.json()) as { messages: ChatMessage[] };

    setConversationId(sessionId);
    setConversationMessages(messages);
  }

  function handleNewChat() {
    setConversationId(undefined);
    setConversationMessages(undefined);
  }

  const isSidebarVisible = getSidebarVisible(isDesktopViewport, isDesktopPanelVisible, mobilePane);
  const shouldShowMainHeader = !isSidebarVisible;
  const shellLayoutClass = getShellLayoutClass(isDesktopViewport, isDesktopPanelVisible);
  const chatPaneVisibilityClass = getChatPaneVisibilityClass(isDesktopViewport, mobilePane);

  return (
    <main className="h-screen overflow-hidden bg-[#1f1f1f] text-stone-100">
      <div className="flex h-full min-h-0 w-full overflow-hidden bg-[#1f1f1f]">
        <section className={`flex min-h-0 flex-1 overflow-hidden ${shellLayoutClass}`}>
          <ChatSidebar
            conversationId={conversationId}
            conversations={conversations}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
            isVisible={isSidebarVisible}
            cognitoLogoutUrl={cognitoLogoutUrl}
            onTogglePanel={handlePanelToggle}
          />

          <div className={`${chatPaneVisibilityClass} min-h-0 flex-1`}>
            <MainChat
              key={conversationId ?? "new"}
              conversationId={conversationId}
              initialMessages={conversationMessages}
              isSidebarVisible={isSidebarVisible}
              onSessionChange={handleSessionChange}
              onTogglePanel={handlePanelToggle}
              shouldShowHeader={shouldShowMainHeader}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test chat-shell`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full test suite and the linter**

Run: `pnpm test`
Expected: all test files PASS.

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/chat-shell.tsx __tests__/components/chat-shell.test.tsx
git commit -m "feat: wire the conversation list, selection, and new chat into ChatShell"
```

---

## Manual infra prerequisites (not part of any task above)

These can't be done from this repo's code and must happen before this feature works against real AWS:

1. Create the two DynamoDB tables from the design doc:
   - `ChatConversations` — partition key `userId` (String), sort key `sessionId` (String).
   - `ChatMessages` — partition key `sessionId` (String), sort key `sortKey` (String).
   - Both on-demand billing mode.
2. Grant the Amplify compute role `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:Query`, and `dynamodb:UpdateItem` on both tables. There is no separate IAM action for `TransactWriteItems` itself — DynamoDB authorizes each operation inside a transaction (`Put`, `Update`) against the same item-level permissions used outside one.
3. Set `CHAT_CONVERSATIONS_TABLE` and `CHAT_MESSAGES_TABLE` in the Amplify environment to the real table names (Task 2's defaults are dev-only fallbacks).
