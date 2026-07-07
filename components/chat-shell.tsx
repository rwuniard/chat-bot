"use client";

import { useEffect, useState } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";
import { MainChat } from "@/components/main-chat";
import {
  getChatPaneVisibilityClass,
  getShellLayoutClass,
  getSidebarVisible,
} from "@/lib/chat-layout";
import type { ChatMessage, ConversationSummary } from "@/types/chat";

interface ChatShellProps {
  readonly cognitoLogoutUrl: string;
}

function upsertConversation(
  conversations: ConversationSummary[],
  sessionId: string,
  title: string,
): ConversationSummary[] {
  const now = new Date().toISOString();
  const existing = conversations.find((conversation) => conversation.sessionId === sessionId);
  const updated: ConversationSummary = existing
    ? { ...existing, updatedAt: now }
    : { sessionId, title, createdAt: now, updatedAt: now };
  const withoutExisting = conversations.filter(
    (conversation) => conversation.sessionId !== sessionId,
  );

  return [updated, ...withoutExisting];
}

export function ChatShell({ cognitoLogoutUrl }: ChatShellProps) {
  const [conversationId, setConversationId] = useState<string>();
  const [conversationViewKey, setConversationViewKey] = useState<string>(() =>
    crypto.randomUUID(),
  );
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationMessages, setConversationMessages] = useState<ChatMessage[]>();
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [isDesktopPanelVisible, setIsDesktopPanelVisible] = useState(true);
  const [mobilePane, setMobilePane] = useState<"chat" | "panel">("chat");

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia("(min-width: 1024px)");

    function updateViewportMode() {
      setIsDesktopViewport(mediaQuery.matches);
    }

    updateViewportMode();
    mediaQuery.addEventListener("change", updateViewportMode);

    return () => {
      mediaQuery.removeEventListener("change", updateViewportMode);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      const response = await fetch("/api/conversations");
      if (!response.ok || cancelled) {
        return;
      }
      const { conversations: loaded } = (await response.json()) as {
        conversations: ConversationSummary[];
      };
      if (!cancelled) {
        setConversations(loaded);
      }
    }

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, []);

  function handlePanelToggle() {
    if (isDesktopViewport) {
      setIsDesktopPanelVisible((currentValue) => !currentValue);
      return;
    }

    setMobilePane((currentValue) => (currentValue === "chat" ? "panel" : "chat"));
  }

  function handleSessionChange({
    conversationId: nextConversationId,
    sessionTitle: nextSessionTitle,
  }: {
    conversationId?: string;
    sessionTitle?: string;
  }) {
    setConversationId(nextConversationId);
    if (nextConversationId) {
      setConversations((currentConversations) =>
        upsertConversation(currentConversations, nextConversationId, nextSessionTitle ?? ""),
      );
    }
  }

  async function handleSelectConversation(sessionId: string) {
    const response = await fetch(`/api/conversations/${sessionId}/messages`);
    if (!response.ok) {
      return;
    }
    const { messages } = (await response.json()) as { messages: ChatMessage[] };

    setConversationId(sessionId);
    setConversationViewKey(sessionId);
    setConversationMessages(messages);
  }

  function handleNewChat() {
    setConversationId(undefined);
    setConversationViewKey(crypto.randomUUID());
    setConversationMessages(undefined);
  }

  const isSidebarVisible = getSidebarVisible(isDesktopViewport, isDesktopPanelVisible, mobilePane);
  const shouldShowMainHeader = !isSidebarVisible;
  const shellLayoutClass = getShellLayoutClass(isDesktopViewport, isDesktopPanelVisible);
  const chatPaneVisibilityClass = getChatPaneVisibilityClass(isDesktopViewport, mobilePane);

  return (
    <main className="h-screen overflow-hidden bg-[#1f1f1f] text-stone-100">
      <div className="flex h-full min-h-0 w-full overflow-hidden bg-[#1f1f1f]">
        <section className={`flex min-h-0 flex-1 overflow-hidden ${shellLayoutClass}`}>
          <ChatSidebar
            conversationId={conversationId}
            conversations={conversations}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
            isVisible={isSidebarVisible}
            cognitoLogoutUrl={cognitoLogoutUrl}
            onTogglePanel={handlePanelToggle}
          />

          <div className={`${chatPaneVisibilityClass} min-h-0 flex-1`}>
            <MainChat
              key={conversationViewKey}
              conversationId={conversationId}
              initialMessages={conversationMessages}
              isSidebarVisible={isSidebarVisible}
              onNewChat={handleNewChat}
              onSessionChange={handleSessionChange}
              onTogglePanel={handlePanelToggle}
              shouldShowHeader={shouldShowMainHeader}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
