import type { ChatMessage, SendMessageRequest, SendMessageResponse } from "@/types/chat";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

const MOCK_NETWORK_DELAY_MS = 900;

function buildMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    status: "complete",
  };
}

export interface ChatApiClient {
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
}

class MockChatApiClient implements ChatApiClient {
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS));

    return {
      conversationId: request.conversationId ?? crypto.randomUUID(),
      reply: buildMessage(
        "assistant",
        `Mock response from ${API_BASE_URL}: "${request.message}" was received. Replace this adapter when the backend is ready.`,
      ),
    };
  }
}

export const chatApiClient: ChatApiClient = new MockChatApiClient();
