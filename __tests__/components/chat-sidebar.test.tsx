import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatSidebar } from "@/components/chat-sidebar";

const conversations = [
  {
    sessionId: "s1",
    title: "First chat",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  },
  {
    sessionId: "s2",
    title: "Second chat",
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
  },
];

describe("ChatSidebar", () => {
  it("shows an empty state when there are no conversations", () => {
    render(
      <ChatSidebar
        conversations={[]}
        onSelectConversation={() => {}}
        onNewChat={() => {}}
        isVisible
        cognitoLogoutUrl="https://example.com/logout"
        onTogglePanel={() => {}}
      />,
    );

    expect(screen.getByText("No conversations yet. Send a message to start one.")).toBeInTheDocument();
  });

  it("renders each conversation and calls onSelectConversation when clicked", () => {
    const handleSelect = vi.fn();
    render(
      <ChatSidebar
        conversations={conversations}
        conversationId="s1"
        onSelectConversation={handleSelect}
        onNewChat={() => {}}
        isVisible
        cognitoLogoutUrl="https://example.com/logout"
        onTogglePanel={() => {}}
      />,
    );

    expect(screen.getByText("First chat")).toBeInTheDocument();
    expect(screen.getByText("Second chat")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Second chat"));
    expect(handleSelect).toHaveBeenCalledWith("s2");
  });

  it("calls onNewChat when the New chat button is clicked", () => {
    const handleNewChat = vi.fn();
    render(
      <ChatSidebar
        conversations={conversations}
        onSelectConversation={() => {}}
        onNewChat={handleNewChat}
        isVisible
        cognitoLogoutUrl="https://example.com/logout"
        onTogglePanel={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(handleNewChat).toHaveBeenCalledTimes(1);
  });
});
