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
