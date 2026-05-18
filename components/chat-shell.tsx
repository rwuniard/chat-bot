"use client";

import { useEffect, useState } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";
import { MainChat } from "@/components/main-chat";
import { chatApiClient } from "@/lib/chat-api";
import type { ChatMessage } from "@/types/chat";

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome-message",
    role: "assistant",
    content:
      "This is the initial chatbot UI shell. The backend is not connected yet, so responses currently come from a mock REST client.",
    createdAt: "2026-05-18T18:00:00.000Z",
    status: "complete",
  },
];

export function ChatShell() {
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>();
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [isDesktopPanelVisible, setIsDesktopPanelVisible] = useState(true);
  const [mobilePane, setMobilePane] = useState<"chat" | "panel">("chat");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    function updateViewportMode() {
      setIsDesktopViewport(mediaQuery.matches);
    }

    updateViewportMode();
    mediaQuery.addEventListener("change", updateViewportMode);

    return () => {
      mediaQuery.removeEventListener("change", updateViewportMode);
    };
  }, []);

  function handlePanelToggle() {
    if (isDesktopViewport) {
      setIsDesktopPanelVisible((currentValue) => !currentValue);
      return;
    }

    setMobilePane((currentValue) => (currentValue === "chat" ? "panel" : "chat"));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedDraft = draft.trim();
    if (!trimmedDraft || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedDraft,
      createdAt: new Date().toISOString(),
      status: "complete",
    };

    setDraft("");
    setError(undefined);
    setIsSending(true);
    setMessages((currentMessages) => [...currentMessages, userMessage]);

    try {
      const response = await chatApiClient.sendMessage({
        conversationId,
        message: trimmedDraft,
      });

      setConversationId(response.conversationId);
      setMessages((currentMessages) => [...currentMessages, response.reply]);
    } catch {
      setError("The message could not be sent. Retry once the backend is available.");
    } finally {
      setIsSending(false);
    }
  }

  const isSidebarVisible = isDesktopViewport ? isDesktopPanelVisible : mobilePane === "panel";
  const shouldShowMainHeader = !isSidebarVisible;

  return (
    <main className="min-h-screen bg-[#1f1f1f] text-stone-100">
      <div className="flex min-h-screen w-full overflow-hidden bg-[#1f1f1f]">
        <section
          className={`flex flex-1 overflow-hidden ${
            isDesktopViewport
              ? isDesktopPanelVisible
                ? "lg:grid lg:grid-cols-[320px_minmax(0,1fr)]"
                : "lg:block"
              : "block"
          }`}
        >
          <ChatSidebar
            conversationId={conversationId}
            isVisible={isSidebarVisible}
            onTogglePanel={handlePanelToggle}
          />

          <div className={`${isDesktopViewport ? "flex" : mobilePane === "chat" ? "flex" : "hidden"} min-h-full flex-1`}>
            <MainChat
              draft={draft}
              error={error}
              isSending={isSending}
              isSidebarVisible={isSidebarVisible}
              messages={messages}
              onChangeDraft={setDraft}
              onSubmit={handleSubmit}
              onTogglePanel={handlePanelToggle}
              shouldShowHeader={shouldShowMainHeader}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
