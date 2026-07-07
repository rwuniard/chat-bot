import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("@aws-sdk/client-bedrock-agentcore", () => ({
  BedrockAgentCoreClient: vi.fn().mockImplementation(function BedrockAgentCoreClient() {
    return { send: mockSend };
  }),
  InvokeAgentRuntimeCommand: vi.fn().mockImplementation(function InvokeAgentRuntimeCommand(
    input: unknown,
  ) {
    return { input };
  }),
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
