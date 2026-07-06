import { describe, expect, it } from "vitest";
import { buildConversationTitle } from "@/lib/conversation-title";

describe("buildConversationTitle", () => {
  it("returns short messages unchanged, trimmed", () => {
    expect(buildConversationTitle("  Hello there  ")).toBe("Hello there");
  });

  it("truncates long messages and appends an ellipsis", () => {
    const longMessage = "a".repeat(80);

    const title = buildConversationTitle(longMessage);

    expect(title).toBe(`${"a".repeat(60)}…`);
  });

  it("does not leave trailing whitespace before the ellipsis", () => {
    const message = `${"a".repeat(59)} ${"b".repeat(20)}`;

    const title = buildConversationTitle(message);

    expect(title.endsWith(" …")).toBe(false);
    expect(title.endsWith("…")).toBe(true);
  });
});
