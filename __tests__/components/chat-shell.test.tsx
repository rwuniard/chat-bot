import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";

vi.mock("@/components/chat-sidebar", () => ({
  ChatSidebar: (props: {
    conversations: { sessionId: string; title: string }[];
    onSelectConversation: (sessionId: string) => void;
    onDeleteConversation: (sessionId: string) => void;
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
          <li key={conversation.sessionId}>
            {conversation.title}
            <button
              type="button"
              onClick={() => props.onDeleteConversation(conversation.sessionId)}
            >
              delete-{conversation.sessionId}
            </button>
          </li>
        ))}
      </ul>
    </div>
  ),
}));

vi.mock("@/components/main-chat", () => ({
  MainChat: (props: {
    conversationId?: string;
    initialMessages?: { content: string }[];
    onSessionChange: (session: { conversationId?: string; sessionTitle?: string }) => void;
  }) => {
    const instanceId = useRef(Math.random()).current;
    return (
      <div>
        <span>conversationId:{props.conversationId ?? "none"}</span>
        <span>messageCount:{props.initialMessages?.length ?? 0}</span>
        <span>instanceId:{instanceId}</span>
        <button
          type="button"
          onClick={() =>
            props.onSessionChange({ conversationId: "brand-new-session", sessionTitle: "Hello" })
          }
        >
          trigger-session-change
        </button>
      </div>
    );
  },
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
    vi.fn((url: string, init?: RequestInit) => {
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
                {
                  sessionId: "s2",
                  title: "Second chat",
                  createdAt: "2026-07-02T00:00:00.000Z",
                  updatedAt: "2026-07-02T00:00:00.000Z",
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
      if (url === "/api/conversations/s1" && init?.method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url === "/api/conversations/s2" && init?.method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 204 }));
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

  it("does not remount MainChat when a live send establishes a new conversation's id", async () => {
    render(<ChatShell cognitoLogoutUrl="https://example.com/logout" />);
    await screen.findByText("First chat");

    const instanceIdBefore = screen.getByText(/^instanceId:/).textContent;

    fireEvent.click(screen.getByText("trigger-session-change"));

    await screen.findByText("conversationId:brand-new-session");
    expect(screen.getByText(/^instanceId:/).textContent).toBe(instanceIdBefore);
  });

  describe("deleting a conversation", () => {
    it("removes a deleted conversation from the sidebar list", async () => {
      render(<ChatShell cognitoLogoutUrl="https://example.com/logout" />);
      await screen.findByText("First chat");

      fireEvent.click(screen.getByText("delete-s1"));

      await vi.waitFor(() => {
        expect(screen.queryByText("First chat")).not.toBeInTheDocument();
      });
    });

    it("resets to a fresh chat when the currently-open conversation is deleted", async () => {
      render(<ChatShell cognitoLogoutUrl="https://example.com/logout" />);
      await screen.findByText("First chat");
      fireEvent.click(screen.getByText("select-s1"));
      await screen.findByText("conversationId:s1");

      fireEvent.click(screen.getByText("delete-s1"));

      expect(await screen.findByText("conversationId:none")).toBeInTheDocument();
      expect(await screen.findByText("messageCount:0")).toBeInTheDocument();
    });

    it("does not reset the open conversation when a different conversation is deleted", async () => {
      render(<ChatShell cognitoLogoutUrl="https://example.com/logout" />);
      await screen.findByText("First chat");
      fireEvent.click(screen.getByText("select-s1"));
      await screen.findByText("conversationId:s1");

      fireEvent.click(screen.getByText("delete-s2"));

      await vi.waitFor(() => {
        expect(screen.queryByText("Second chat")).not.toBeInTheDocument();
      });
      expect(screen.getByText("conversationId:s1")).toBeInTheDocument();
    });

    it("leaves the sidebar list unchanged when the delete request fails", async () => {
      const fetchMock = vi.fn((url: string, init?: RequestInit) => {
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
        if (url === "/api/conversations/s1" && init?.method === "DELETE") {
          return Promise.resolve(new Response(null, { status: 500 }));
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<ChatShell cognitoLogoutUrl="https://example.com/logout" />);
      await screen.findByText("First chat");

      fireEvent.click(screen.getByText("delete-s1"));

      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith("/api/conversations/s1", { method: "DELETE" });
      });
      expect(screen.getByText("First chat")).toBeInTheDocument();
    });
  });
});
