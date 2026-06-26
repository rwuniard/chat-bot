import type { SendMessageRequest, SendMessageResponse } from "@/types/chat";

export interface ChatApiClient {
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
}

class RestChatApiClient implements ChatApiClient {
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId: request.conversationId,
        message: request.message,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `Chat API request failed with status ${response.status}`);
    }

    return response.json() as Promise<SendMessageResponse>;
  }
}

export const chatApiClient: ChatApiClient = new RestChatApiClient();
