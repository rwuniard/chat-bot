import type { SendMessageRequest, SendMessageResponse } from "@/types/chat";

export interface ChatApiClient {
  sendMessage(request: Readonly<SendMessageRequest>): Promise<SendMessageResponse>;
}

function isSendMessageResponse(payload: unknown): payload is SendMessageResponse {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const { conversationId, reply } = payload as SendMessageResponse;

  return (
    typeof conversationId === "string" &&
    typeof reply === "object" &&
    reply !== null &&
    typeof reply.content === "string"
  );
}

class RestChatApiClient implements ChatApiClient {
  async sendMessage(request: Readonly<SendMessageRequest>): Promise<SendMessageResponse> {
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

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON";
      throw new Error(`Chat API returned invalid JSON: ${message}`);
    }

    if (!response.ok) {
      const errorMessage =
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : `Chat API request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    if (!isSendMessageResponse(payload)) {
      throw new Error("Chat API returned an unexpected response shape");
    }

    return payload;
  }
}

export const chatApiClient: ChatApiClient = new RestChatApiClient();
