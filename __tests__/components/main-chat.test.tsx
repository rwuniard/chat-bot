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
        onNewChat={() => {}}
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
