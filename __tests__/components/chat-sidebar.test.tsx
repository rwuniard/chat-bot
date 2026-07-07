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
        onDeleteConversation={() => {}}
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
        onDeleteConversation={() => {}}
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
        onDeleteConversation={() => {}}
        onNewChat={handleNewChat}
        isVisible
        cognitoLogoutUrl="https://example.com/logout"
        onTogglePanel={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(handleNewChat).toHaveBeenCalledTimes(1);
  });

  describe("deleting a conversation", () => {
    function renderSidebar(onDeleteConversation = vi.fn()) {
      render(
        <ChatSidebar
          conversations={conversations}
          onSelectConversation={() => {}}
          onDeleteConversation={onDeleteConversation}
          onNewChat={() => {}}
          isVisible
          cognitoLogoutUrl="https://example.com/logout"
          onTogglePanel={() => {}}
        />,
      );
      return onDeleteConversation;
    }

    it("opens the menu, shows an inline confirm, and calls onDeleteConversation when confirmed", () => {
      const handleDelete = renderSidebar();

      fireEvent.click(screen.getByRole("button", { name: "More options for First chat" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

      expect(screen.getByText("Delete this conversation?")).toBeInTheDocument();
      expect(handleDelete).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      expect(handleDelete).toHaveBeenCalledWith("s1");
    });

    it("closes the menu without deleting when Cancel is clicked", () => {
      const handleDelete = renderSidebar();

      fireEvent.click(screen.getByRole("button", { name: "More options for First chat" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(handleDelete).not.toHaveBeenCalled();
      expect(screen.queryByText("Delete this conversation?")).not.toBeInTheDocument();
    });

    it("closes the menu when clicking outside", () => {
      renderSidebar();

      fireEvent.click(screen.getByRole("button", { name: "More options for First chat" }));
      expect(screen.getByRole("menu")).toBeInTheDocument();

      fireEvent.mouseDown(document.body);

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("closes the menu on Escape", () => {
      renderSidebar();

      fireEvent.click(screen.getByRole("button", { name: "More options for First chat" }));
      expect(screen.getByRole("menu")).toBeInTheDocument();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });
});
