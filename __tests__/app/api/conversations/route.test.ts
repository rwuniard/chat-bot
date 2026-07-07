import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/chat-history", () => ({ listConversationsForUser: vi.fn() }));

import { getSession } from "@/lib/session";
import { listConversationsForUser } from "@/lib/chat-history";
import { GET } from "@/app/api/conversations/route";

const mockGetSession = getSession as unknown as ReturnType<typeof vi.fn>;
const mockListConversations = listConversationsForUser as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockGetSession.mockReset();
  mockListConversations.mockReset();
});

describe("GET /api/conversations", () => {
  it("returns 401 when there is no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockListConversations).not.toHaveBeenCalled();
  });

  it("returns the user's conversations when authenticated", async () => {
    mockGetSession.mockResolvedValueOnce({ userId: "user-1", email: "a@b.com" });
    mockListConversations.mockResolvedValueOnce([
      {
        sessionId: "s1",
        title: "Hello",
        createdAt: "2026-07-06T00:00:00.000Z",
        updatedAt: "2026-07-06T00:00:00.000Z",
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockListConversations).toHaveBeenCalledWith("user-1");
    expect(body).toEqual({
      conversations: [
        {
          sessionId: "s1",
          title: "Hello",
          createdAt: "2026-07-06T00:00:00.000Z",
          updatedAt: "2026-07-06T00:00:00.000Z",
        },
      ],
    });
  });
});
