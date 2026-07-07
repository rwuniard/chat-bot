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
    const conditionError = new Error("Transaction cancelled") as Error & {
      CancellationReasons?: Array<{ Code?: string }>;
    };
    conditionError.name = "TransactionCanceledException";
    conditionError.CancellationReasons = [{ Code: "ConditionalCheckFailed" }, { Code: "None" }];
    send.mockRejectedValueOnce(conditionError);

    await expect(
      appendUserMessageToConversation("user-1", "someone-elses-session", userMessage),
    ).rejects.toThrow(ConversationNotFoundError);
  });

  it("propagates the original error when the transaction is cancelled for an unrelated reason", async () => {
    const throttlingError = new Error("Transaction cancelled") as Error & {
      CancellationReasons?: Array<{ Code?: string }>;
    };
    throttlingError.name = "TransactionCanceledException";
    throttlingError.CancellationReasons = [{ Code: "None" }, { Code: "ThrottlingError" }];
    send.mockRejectedValueOnce(throttlingError);

    await expect(
      appendUserMessageToConversation("user-1", "session-1", userMessage),
    ).rejects.toBe(throttlingError);
  });
});
