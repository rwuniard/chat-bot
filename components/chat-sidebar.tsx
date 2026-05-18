"use client";

import { SidebarControlIcon } from "@/components/sidebar-control-icon";

const SIDEBAR_ITEMS = [{ label: "Chat Bot", icon: "spark" }] as const;

function SidebarIcon({ kind }: { kind: (typeof SIDEBAR_ITEMS)[number]["icon"] }) {
  const commonProps = {
    className: "h-6 w-6",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  if (kind === "spark") {
    return (
      <svg {...commonProps}>
        <path d="M12 3.5c1.2 2.8 2.7 4.3 5.5 5.5-2.8 1.2-4.3 2.7-5.5 5.5-1.2-2.8-2.7-4.3-5.5-5.5 2.8-1.2 4.3-2.7 5.5-5.5Z" />
        <path d="M6.5 13.5c.8 1.8 1.7 2.7 3.5 3.5-1.8.8-2.7 1.7-3.5 3.5-.8-1.8-1.7-2.7-3.5-3.5 1.8-.8 2.7-1.7 3.5-3.5Z" />
        <path d="M17.5 13.5c.6 1.4 1.6 2.4 3 3-.9.4-1.6.9-2.1 1.5-.5.6-.8 1.2-.9 1.9-.2-.8-.5-1.4-.9-1.9-.5-.6-1.2-1.1-2.1-1.5 1.4-.6 2.4-1.6 3-3Z" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M12 3.5 19 7.5v9L12 20.5 5 16.5v-9l7-4Z" />
      <path d="M5 7.5 12 11.5l7-4" />
      <path d="M12 11.5v9" />
    </svg>
  );
}

interface ChatSidebarProps {
  conversationId?: string;
  isVisible: boolean;
  onTogglePanel: () => void;
}

export function ChatSidebar({
  conversationId,
  isVisible,
  onTogglePanel,
}: ChatSidebarProps) {
  return (
    <aside
      id="chat-side-panel"
      className={`${isVisible ? "flex" : "hidden"} min-h-full w-full flex-col border-r border-white/6 bg-[#242424] px-4 py-4 text-stone-100 lg:w-[300px] lg:min-w-[300px]`}
    >
      <div className="flex h-12 items-center gap-3 px-2 text-stone-500">
        <div className="flex items-center gap-4">
          <button
            aria-controls="chat-side-panel"
            aria-expanded={isVisible}
            aria-label="Hide side panel"
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-stone-300 transition hover:bg-white/[0.08] hover:text-white"
            type="button"
            onClick={onTogglePanel}
          >
            <SidebarControlIcon kind="sidebar" />
          </button>
          <button
            aria-label="Compose new chat"
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-stone-300 transition hover:bg-white/[0.08] hover:text-white"
            type="button"
          >
            <SidebarControlIcon kind="compose" />
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-3 text-stone-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="flex items-center gap-3 text-lg">
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <span className="text-[1.05rem] font-medium">Search</span>
        </div>
      </div>

      <nav className="mt-5 space-y-1">
        {SIDEBAR_ITEMS.map((item, index) => {
          const isActive = index === 0;

          return (
            <button
              key={item.label}
              className={`flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left text-[1.05rem] font-semibold transition ${
                isActive
                  ? "bg-white/[0.08] text-white"
                  : "text-stone-100/95 hover:bg-white/[0.05] hover:text-white"
              }`}
              type="button"
            >
              <span className="text-stone-100">
                <SidebarIcon kind={item.icon} />
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 space-y-3 px-2">
        <div className="rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Current session</p>
          <p className="mt-3 text-sm leading-6 text-stone-200">
            {conversationId ? `Conversation: ${conversationId}` : "No conversation created yet."}
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Integration</p>
          <p className="mt-3 text-sm leading-6 text-stone-200">
            The composer currently talks to a mock API client. Replace it later with the real REST service.
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Next steps</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-200">
            <li>Define the final message contract.</li>
            <li>Wire the backend base URL through environment config.</li>
            <li>Add streaming or polling if the agent requires it.</li>
          </ul>
        </div>
      </div>
    </aside>
  );
}
