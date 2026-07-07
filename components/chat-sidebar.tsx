"use client";

import { useEffect, useRef, useState } from "react";
import { ChatHeaderControls } from "@/components/chat-header-controls";
import { SignOutButton } from "@/components/sign-out-button";
import type { ConversationSummary } from "@/types/chat";

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

function formatConversationTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function MoreOptionsIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

interface ConversationRowProps {
  readonly conversation: ConversationSummary;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly onDelete: () => void;
}

function ConversationRow({
  conversation,
  isSelected,
  onSelect,
  onDelete,
}: Readonly<ConversationRowProps>) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setIsConfirmingDelete(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsConfirmingDelete(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <li className="group relative">
      <div className="flex w-full items-center gap-1 rounded-2xl">
        <button
          className={`flex min-w-0 flex-1 flex-col gap-1 rounded-2xl px-4 py-3 text-left transition ${
            isSelected ? "bg-white/12 text-white" : "text-stone-300 hover:bg-white/6"
          }`}
          type="button"
          onClick={onSelect}
        >
          <span className="truncate text-sm font-medium">{conversation.title}</span>
          <span className="text-xs uppercase tracking-[0.14em] text-stone-500">
            {formatConversationTimestamp(conversation.updatedAt)}
          </span>
        </button>

        <button
          className="shrink-0 rounded-full p-2 text-stone-400 opacity-0 transition hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
          type="button"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-label={`More options for ${conversation.title}`}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <MoreOptionsIcon />
        </button>
      </div>

      {isMenuOpen && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-2 top-full z-10 mt-1 w-40 rounded-xl border border-white/10 bg-[#2c2c2c] py-1 shadow-lg"
        >
          {!isConfirmingDelete ? (
            <button
              role="menuitem"
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/6"
              onClick={() => setIsConfirmingDelete(true)}
            >
              Delete
            </button>
          ) : (
            <div className="px-3 py-2">
              <p className="mb-2 text-xs text-stone-300">Delete this conversation?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-red-500/90 px-2 py-1 text-xs font-medium text-white hover:bg-red-500"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsConfirmingDelete(false);
                    onDelete();
                  }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-white/10 px-2 py-1 text-xs text-stone-200 hover:bg-white/15"
                  onClick={() => setIsConfirmingDelete(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

interface ConversationListProps {
  readonly conversations: ConversationSummary[];
  readonly selectedConversationId?: string;
  readonly onSelectConversation: (sessionId: string) => void;
  readonly onDeleteConversation: (sessionId: string) => void;
}

function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onDeleteConversation,
}: Readonly<ConversationListProps>) {
  if (conversations.length === 0) {
    return (
      <p className="px-2 text-sm leading-6 text-stone-500">
        No conversations yet. Send a message to start one.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {conversations.map((conversation) => (
        <ConversationRow
          key={conversation.sessionId}
          conversation={conversation}
          isSelected={conversation.sessionId === selectedConversationId}
          onSelect={() => onSelectConversation(conversation.sessionId)}
          onDelete={() => onDeleteConversation(conversation.sessionId)}
        />
      ))}
    </ul>
  );
}

interface ChatSidebarProps {
  readonly conversationId?: string;
  readonly conversations: ConversationSummary[];
  readonly onSelectConversation: (sessionId: string) => void;
  readonly onDeleteConversation: (sessionId: string) => void;
  readonly onNewChat: () => void;
  readonly isVisible: boolean;
  readonly cognitoLogoutUrl: string;
  readonly onTogglePanel: () => void;
}

export function ChatSidebar({
  conversationId,
  conversations,
  onSelectConversation,
  onDeleteConversation,
  onNewChat,
  isVisible,
  cognitoLogoutUrl,
  onTogglePanel,
}: Readonly<ChatSidebarProps>) {
  return (
    <aside
      id="chat-side-panel"
      className={`${isVisible ? "flex" : "hidden"} min-h-full w-full flex-col border-r border-white/6 bg-[#242424] px-4 py-4 text-stone-100 lg:w-[300px] lg:min-w-[300px]`}
    >
      <div className="flex h-12 items-center gap-3 px-2 text-stone-500">
        <div className="flex items-center gap-4">
          <ChatHeaderControls
            isSidebarVisible={isVisible}
            onTogglePanel={onTogglePanel}
            onNewChat={onNewChat}
          />
        </div>
      </div>

      <button
        className="mt-5 flex w-full items-center gap-4 rounded-2xl bg-white/8 px-4 py-4 text-left text-[1.05rem] font-semibold text-white transition hover:bg-white/12"
        type="button"
        onClick={onNewChat}
      >
        <span className="text-stone-100">
          <SparkIcon />
        </span>
        <span>New chat</span>
      </button>

      <nav className="mt-5 flex-1 space-y-1 overflow-y-auto">
        <ConversationList
          conversations={conversations}
          selectedConversationId={conversationId}
          onSelectConversation={onSelectConversation}
          onDeleteConversation={onDeleteConversation}
        />
      </nav>

      <div className="mt-auto pt-4 border-t border-white/6">
        <SignOutButton cognitoLogoutUrl={cognitoLogoutUrl} />
      </div>
    </aside>
  );
}
