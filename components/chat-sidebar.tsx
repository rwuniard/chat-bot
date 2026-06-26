"use client";

import type { ReactNode } from "react";
import { ChatHeaderControls } from "@/components/chat-header-controls";

const SIDEBAR_ITEMS = [{ label: "Chat Bot", icon: "spark" }] as const;

function SparkIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path d="M12 3.5c1.2 2.8 2.7 4.3 5.5 5.5-2.8 1.2-4.3 2.7-5.5 5.5-1.2-2.8-2.7-4.3-5.5-5.5 2.8-1.2 4.3-2.7 5.5-5.5Z" />
      <path d="M6.5 13.5c.8 1.8 1.7 2.7 3.5 3.5-1.8.8-2.7 1.7-3.5 3.5-.8-1.8-1.7-2.7-3.5-3.5 1.8-.8 2.7-1.7 3.5-3.5Z" />
      <path d="M17.5 13.5c.6 1.4 1.6 2.4 3 3-.9.4-1.6.9-2.1 1.5-.5.6-.8 1.2-.9 1.9-.2-.8-.5-1.4-.9-1.9-.5-.6-1.2-1.1-2.1-1.5 1.4-.6 2.4-1.6 3-3Z" />
    </svg>
  );
}

interface SidebarInfoCardProps {
  readonly title: string;
  readonly children: ReactNode;
}

function SidebarInfoCard({ title, children }: SidebarInfoCardProps) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/4 px-4 py-4">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">{title}</p>
      {children}
    </div>
  );
}

interface ChatSidebarProps {
  readonly conversationId?: string;
  readonly sessionTitle?: string;
  readonly isVisible: boolean;
  readonly onTogglePanel: () => void;
}

export function ChatSidebar({
  conversationId,
  sessionTitle,
  isVisible,
  onTogglePanel,
}: Readonly<ChatSidebarProps>) {
  return (
    <aside
      id="chat-side-panel"
      className={`${isVisible ? "flex" : "hidden"} min-h-full w-full flex-col border-r border-white/6 bg-[#242424] px-4 py-4 text-stone-100 lg:w-[300px] lg:min-w-[300px]`}
    >
      <div className="flex h-12 items-center gap-3 px-2 text-stone-500">
        <div className="flex items-center gap-4">
          <ChatHeaderControls isSidebarVisible={isVisible} onTogglePanel={onTogglePanel} />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/5 bg-white/4 px-4 py-3 text-stone-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="flex items-center gap-3 text-lg">
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <span className="text-[1.05rem] font-medium">Search</span>
        </div>
      </div>

      <nav className="mt-5 space-y-1">
        {SIDEBAR_ITEMS.map((item) => (
          <button
            key={item.label}
            className="flex w-full items-center gap-4 rounded-2xl bg-white/8 px-4 py-4 text-left text-[1.05rem] font-semibold text-white transition"
            type="button"
          >
            <span className="text-stone-100">
              <SparkIcon />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-4 space-y-3 px-2">
        <SidebarInfoCard title="Current session">
          <p className="mt-3 text-sm leading-6 text-stone-200">
            {sessionTitle ?? "No conversation created yet."}
          </p>
          {conversationId ? (
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-stone-500">ID: {conversationId}</p>
          ) : null}
        </SidebarInfoCard>

        <SidebarInfoCard title="Integration">
          <p className="mt-3 text-sm leading-6 text-stone-200">
            Messages are sent to the configured backend REST API.
          </p>
        </SidebarInfoCard>

        <SidebarInfoCard title="Next steps">
          <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-200">
            <li>Define the final message contract.</li>
            <li>Wire the backend base URL through environment config.</li>
            <li>Add streaming or polling if the agent requires it.</li>
          </ul>
        </SidebarInfoCard>
      </div>
    </aside>
  );
}
