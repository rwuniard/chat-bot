import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatHeaderControls } from "@/components/chat-header-controls";

describe("ChatHeaderControls", () => {
  it("calls onNewChat when the compose button is clicked", () => {
    const handleNewChat = vi.fn();
    render(
      <ChatHeaderControls isSidebarVisible onTogglePanel={() => {}} onNewChat={handleNewChat} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start new chat" }));
    expect(handleNewChat).toHaveBeenCalledTimes(1);
  });

  it("calls onTogglePanel when the sidebar toggle button is clicked", () => {
    const handleToggle = vi.fn();
    render(
      <ChatHeaderControls isSidebarVisible onTogglePanel={handleToggle} onNewChat={() => {}} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide side panel" }));
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });
});
