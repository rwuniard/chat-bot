"use client";

import { SidebarControlIcon } from "@/components/sidebar-control-icon";

const HEADER_ICON_BUTTON_CLASS =
  "inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/4 text-stone-300 transition hover:bg-white/8 hover:text-white";

interface ChatHeaderControlsProps {
  readonly isSidebarVisible: boolean;
  readonly onTogglePanel: () => void;
  readonly onNewChat: () => void;
}

export function ChatHeaderControls({
  isSidebarVisible,
  onTogglePanel,
  onNewChat,
}: ChatHeaderControlsProps) {
  return (
    <>
      <button
        aria-controls="chat-side-panel"
        aria-expanded={isSidebarVisible}
        aria-label={isSidebarVisible ? "Hide side panel" : "Show side panel"}
        className={HEADER_ICON_BUTTON_CLASS}
        type="button"
        onClick={onTogglePanel}
      >
        <SidebarControlIcon kind="sidebar" />
      </button>

      <button
        aria-label="Start new chat"
        className={HEADER_ICON_BUTTON_CLASS}
        type="button"
        onClick={onNewChat}
      >
        <SidebarControlIcon kind="compose" />
      </button>
    </>
  );
}
