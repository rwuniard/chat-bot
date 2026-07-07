import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/chat-history", () => ({ loadConversationMessages: vi.fn() }));

import { getSession } from "@/lib/session";
import { loadConversationMessages } from "@/lib/chat-history";
import { GET } from "@/app/api/conversations/[sessionId]/messages/route";

const mockGetSession = getSession as unknown as ReturnType<typeof vi.fn>;
const mockLoadMessages = loadConversationMessages as unknown as ReturnType<typeof vi.fn>;

function makeParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

beforeEach(() => {
  mockGetSession.mockReset();
  mockLoadMessages.mockReset();
});

describe("GET /api/conversations/:sessionId/messages", () => {
  it("returns 401 when there is no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const response = await GET(
      new Request("http://localhost/api/conversations/s1/messages"),
      makeParams("s1"),
    );

    expect(response.status).toBe(401);
    expect(mockLoadMessages).not.toHaveBeenCalled();
  });

  it("returns 404 when the conversation isn't found or owned", async () => {
    mockGetSession.mockResolvedValueOnce({ userId: "user-1", email: "a@b.com" });
    mockLoadMessages.mockResolvedValueOnce(null);

    const response = await GET(
      new Request("http://localhost/api/conversations/s1/messages"),
      makeParams("s1"),
    );

    expect(response.status).toBe(404);
  });

  it("returns the conversation's messages when found", async () => {
    mockGetSession.mockResolvedValueOnce({ userId: "user-1", email: "a@b.com" });
    mockLoadMessages.mockResolvedValueOnce([
      { id: "msg-1", role: "user", content: "Hi", createdAt: "2026-07-06T00:00:00.000Z", status: "complete" },
    ]);

    const response = await GET(
      new Request("http://localhost/api/conversations/s1/messages"),
      makeParams("s1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockLoadMessages).toHaveBeenCalledWith("user-1", "s1");
    expect(body.messages).toHaveLength(1);
  });
});
