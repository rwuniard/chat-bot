"use client";

import { useEffect, useState } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";
import { MainChat } from "@/components/main-chat";

export function ChatShell() {
  const [conversationId, setConversationId] = useState<string>();
  const [sessionTitle, setSessionTitle] = useState<string>();
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
            sessionTitle={sessionTitle}
            isVisible={isSidebarVisible}
            onTogglePanel={handlePanelToggle}
          />

          <div className={`${isDesktopViewport ? "flex" : mobilePane === "chat" ? "flex" : "hidden"} min-h-full flex-1`}>
            <MainChat
              isSidebarVisible={isSidebarVisible}
              onSessionChange={({ conversationId: nextConversationId, sessionTitle: nextSessionTitle }) => {
                setConversationId(nextConversationId);
                if (nextSessionTitle) {
                  setSessionTitle(nextSessionTitle);
                }
              }}
              onTogglePanel={handlePanelToggle}
              shouldShowHeader={shouldShowMainHeader}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
