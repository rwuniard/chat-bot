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
