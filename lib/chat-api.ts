import type { SendMessageRequest } from "@/types/chat";

// `onChunk` is how the streamed reply gets out of this module: the promise
// resolving only tells the caller the request is *done*, so incremental text
// has to be pushed out via callback as it arrives, rather than returned.
export interface SendMessageOptions {
  readonly onChunk?: (chunk: string) => void;
}

// No `reply` field here (unlike the old JSON response shape) - by the time
// this resolves, the caller already has the full text via onChunk. Returning
// it again would just be a second, redundant copy of the same string.
export interface SendMessageResult {
  readonly conversationId: string;
}

export interface ChatApiClient {
  sendMessage(
    request: Readonly<SendMessageRequest>,
    options?: SendMessageOptions,
  ): Promise<SendMessageResult>;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
    ) {
      return (payload as { error: string }).error;
    }
  } catch {
    // response body wasn't JSON; fall through to the default message
  }
  return `Chat API request failed with status ${response.status}`;
}

class RestChatApiClient implements ChatApiClient {
  async sendMessage(
    request: Readonly<SendMessageRequest>,
    options?: SendMessageOptions,
  ): Promise<SendMessageResult> {
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
      throw new Error(await readErrorMessage(response));
    }

    // conversationId rides in a header now, not the body - the body is the
    // raw reply text (see app/api/chat/route.ts), so there's no JSON left to
    // pull it out of.
    const conversationId = response.headers.get("X-Conversation-Id");
    if (!conversationId) {
      throw new Error("Chat API response is missing the conversation id");
    }

    if (!response.body) {
      throw new Error("Chat API response has no body");
    }

    // Read the body incrementally instead of `await response.text()` - that's
    // the whole point of this change. Each `read()` resolves as soon as the
    // route forwards a chunk, so `onChunk` fires progressively while the
    // reply is still being generated, not once at the very end.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let receivedAny = false;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) continue;

      receivedAny = true;
      options?.onChunk?.(chunk);
    }

    if (!receivedAny) {
      throw new Error("AgentCore returned an empty response");
    }

    return { conversationId };
  }
}

export const chatApiClient: ChatApiClient = new RestChatApiClient();
