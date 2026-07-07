import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/chat-history", () => ({
  ConversationNotFoundError: class ConversationNotFoundError extends Error {},
  deleteConversation: vi.fn(),
}));

import { getSession } from "@/lib/session";
import { ConversationNotFoundError, deleteConversation } from "@/lib/chat-history";
import { DELETE } from "@/app/api/conversations/[sessionId]/route";

const mockGetSession = getSession as unknown as ReturnType<typeof vi.fn>;
const mockDeleteConversation = deleteConversation as unknown as ReturnType<typeof vi.fn>;

function makeParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

beforeEach(() => {
  mockGetSession.mockReset();
  mockDeleteConversation.mockReset();
});

describe("DELETE /api/conversations/:sessionId", () => {
  it("returns 401 when there is no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const response = await DELETE(new Request("http://localhost/api/conversations/s1"), makeParams("s1"));

    expect(response.status).toBe(401);
    expect(mockDeleteConversation).not.toHaveBeenCalled();
  });

  it("returns 404 when the conversation isn't found or owned", async () => {
    mockGetSession.mockResolvedValueOnce({ userId: "user-1", email: "a@b.com" });
    mockDeleteConversation.mockRejectedValueOnce(new ConversationNotFoundError("s1"));

    const response = await DELETE(new Request("http://localhost/api/conversations/s1"), makeParams("s1"));

    expect(response.status).toBe(404);
  });

  it("returns 204 when deletion succeeds", async () => {
    mockGetSession.mockResolvedValueOnce({ userId: "user-1", email: "a@b.com" });
    mockDeleteConversation.mockResolvedValueOnce(undefined);

    const response = await DELETE(new Request("http://localhost/api/conversations/s1"), makeParams("s1"));

    expect(response.status).toBe(204);
    expect(mockDeleteConversation).toHaveBeenCalledWith("user-1", "s1");
  });

  it("propagates unexpected errors instead of mapping them to 404", async () => {
    mockGetSession.mockResolvedValueOnce({ userId: "user-1", email: "a@b.com" });
    mockDeleteConversation.mockRejectedValueOnce(new Error("DynamoDB is unavailable"));

    await expect(
      DELETE(new Request("http://localhost/api/conversations/s1"), makeParams("s1")),
    ).rejects.toThrow("DynamoDB is unavailable");
  });
});
