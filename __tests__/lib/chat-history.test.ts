import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/types/chat";

vi.mock("@/lib/dynamodb-client", () => ({
  docClient: { send: vi.fn() },
  getTableNames: () => ({ conversations: "TestConversations", messages: "TestMessages" }),
}));

import { docClient } from "@/lib/dynamodb-client";
import {
  ConversationNotFoundError,
  appendAssistantMessage,
  appendUserMessageToConversation,
  createConversationWithFirstMessage,
  deleteConversation,
  listConversationsForUser,
  loadConversationMessages,
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

function messageKeyItems(count: number, offset = 0) {
  return Array.from({ length: count }, (_, index) => ({
    sessionId: "session-1",
    sortKey: `2026-07-06T18:00:${String(index + offset).padStart(2, "0")}.000Z#msg-${index + offset}`,
  }));
}

describe("deleteConversation", () => {
  it("deletes the conversation row conditionally, then queries and batch-deletes its messages", async () => {
    send.mockResolvedValueOnce({});
    send.mockResolvedValueOnce({ Items: messageKeyItems(3) });
    send.mockResolvedValueOnce({});

    await deleteConversation("user-1", "session-1");

    expect(send).toHaveBeenCalledTimes(3);

    const deleteCall = send.mock.calls[0][0];
    expect(deleteCall.input.TableName).toBe("TestConversations");
    expect(deleteCall.input.Key).toEqual({ userId: "user-1", sessionId: "session-1" });
    expect(deleteCall.input.ConditionExpression).toBe("attribute_exists(sessionId)");

    const batchCall = send.mock.calls[2][0];
    const requests = batchCall.input.RequestItems.TestMessages;
    expect(requests).toHaveLength(3);
    expect(requests[0].DeleteRequest.Key).toEqual({
      sessionId: "session-1",
      sortKey: "2026-07-06T18:00:00.000Z#msg-0",
    });
  });

  it("throws ConversationNotFoundError when the conversation isn't owned by this user", async () => {
    const conditionError = new Error("The conditional request failed");
    conditionError.name = "ConditionalCheckFailedException";
    send.mockRejectedValueOnce(conditionError);

    await expect(deleteConversation("user-1", "someone-elses-session")).rejects.toThrow(
      ConversationNotFoundError,
    );
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("propagates unexpected errors from the conditional delete", async () => {
    const throttlingError = new Error("Rate exceeded");
    throttlingError.name = "ThrottlingException";
    send.mockRejectedValueOnce(throttlingError);

    await expect(deleteConversation("user-1", "session-1")).rejects.toBe(throttlingError);
  });

  it("pages through more than 25 messages and issues multiple batched deletes", async () => {
    send.mockResolvedValueOnce({}); // conditional delete
    send.mockResolvedValueOnce({
      Items: messageKeyItems(30),
      LastEvaluatedKey: { sessionId: "session-1", sortKey: "page-1-end" },
    }); // page 1 query
    send.mockResolvedValueOnce({}); // page 1, chunk 1 (25 items)
    send.mockResolvedValueOnce({}); // page 1, chunk 2 (5 items)
    send.mockResolvedValueOnce({ Items: messageKeyItems(10, 30) }); // page 2 query
    send.mockResolvedValueOnce({}); // page 2, chunk 1 (10 items)

    await deleteConversation("user-1", "session-1");

    expect(send).toHaveBeenCalledTimes(6);

    const page1Chunk1 = send.mock.calls[2][0].input.RequestItems.TestMessages;
    const page1Chunk2 = send.mock.calls[3][0].input.RequestItems.TestMessages;
    const page2Chunk1 = send.mock.calls[5][0].input.RequestItems.TestMessages;
    expect(page1Chunk1).toHaveLength(25);
    expect(page1Chunk2).toHaveLength(5);
    expect(page2Chunk1).toHaveLength(10);

    const page2Query = send.mock.calls[4][0].input;
    expect(page2Query.ExclusiveStartKey).toEqual({ sessionId: "session-1", sortKey: "page-1-end" });
  });

  it("does nothing beyond the conditional delete when the conversation has zero messages", async () => {
    send.mockResolvedValueOnce({});
    send.mockResolvedValueOnce({ Items: [] });

    await deleteConversation("user-1", "session-1");

    expect(send).toHaveBeenCalledTimes(2);
  });

  it("logs and does not throw when message cleanup fails after the conversation is already deleted", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    send.mockResolvedValueOnce({});
    send.mockRejectedValueOnce(new Error("DynamoDB is unavailable"));

    await expect(deleteConversation("user-1", "session-1")).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
