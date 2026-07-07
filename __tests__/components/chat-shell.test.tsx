import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/chat-sidebar", () => ({
  ChatSidebar: (props: {
    conversations: { sessionId: string; title: string }[];
    onSelectConversation: (sessionId: string) => void;
    onNewChat: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => props.onSelectConversation("s1")}>
        select-s1
      </button>
      <button type="button" onClick={props.onNewChat}>
        new-chat
      </button>
      <ul>
        {props.conversations.map((conversation) => (
          <li key={conversation.sessionId}>{conversation.title}</li>
        ))}
      </ul>
    </div>
  ),
}));

vi.mock("@/components/main-chat", () => ({
  MainChat: (props: { conversationId?: string; initialMessages?: { content: string }[] }) => (
    <div>
      <span>conversationId:{props.conversationId ?? "none"}</span>
      <span>messageCount:{props.initialMessages?.length ?? 0}</span>
    </div>
  ),
}));

import { ChatShell } from "@/components/chat-shell";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/api/conversations") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              conversations: [
                {
                  sessionId: "s1",
                  title: "First chat",
                  createdAt: "2026-07-01T00:00:00.000Z",
                  updatedAt: "2026-07-01T00:00:00.000Z",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url === "/api/conversations/s1/messages") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              messages: [
                {
                  id: "m1",
                  role: "user",
                  content: "Hi",
                  createdAt: "2026-07-01T00:00:00.000Z",
                  status: "complete",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch to ${url}`));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChatShell", () => {
  it("loads the conversation list on mount", async () => {
    render(<ChatShell cognitoLogoutUrl="https://example.com/logout" />);

    expect(await screen.findByText("First chat")).toBeInTheDocument();
  });

  it("loads a conversation's messages when selected from the sidebar", async () => {
    render(<ChatShell cognitoLogoutUrl="https://example.com/logout" />);
    await screen.findByText("First chat");

    fireEvent.click(screen.getByText("select-s1"));

    expect(await screen.findByText("conversationId:s1")).toBeInTheDocument();
    expect(await screen.findByText("messageCount:1")).toBeInTheDocument();
  });

  it("resets to a fresh chat when New chat is clicked", async () => {
    render(<ChatShell cognitoLogoutUrl="https://example.com/logout" />);
    await screen.findByText("First chat");
    fireEvent.click(screen.getByText("select-s1"));
    await screen.findByText("conversationId:s1");

    fireEvent.click(screen.getByText("new-chat"));

    expect(await screen.findByText("conversationId:none")).toBeInTheDocument();
    expect(await screen.findByText("messageCount:0")).toBeInTheDocument();
  });
});
