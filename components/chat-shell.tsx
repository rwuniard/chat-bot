"use client";

import { useEffect, useState } from "react";
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

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f5f0e8_0%,#eadfce_42%,#d8ccb7_100%)] text-stone-900">
      <div className="flex min-h-screen w-full flex-col overflow-hidden bg-[#fdfaf3]/95 shadow-[0_24px_100px_rgba(78,52,28,0.18)] backdrop-blur">
        <section className="border-b border-stone-900/10 px-5 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <button
                aria-controls="chat-side-panel"
                aria-expanded={isDesktopViewport ? isDesktopPanelVisible : mobilePane === "panel"}
                aria-label={
                  isDesktopViewport
                    ? isDesktopPanelVisible
                      ? "Hide side panel"
                      : "Show side panel"
                    : mobilePane === "panel"
                      ? "Show chat window"
                      : "Show side panel"
                }
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-900/10 bg-white text-stone-900 shadow-sm transition hover:border-stone-900/25 hover:bg-stone-50"
                type="button"
                onClick={handlePanelToggle}
              >
                <span className="text-lg leading-none">
                  {isDesktopViewport ? (isDesktopPanelVisible ? "×" : "☰") : mobilePane === "panel" ? "←" : "☰"}
                </span>
              </button>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
                  Agentic UI Prototype
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
                  Chat interface for a future REST-backed AI agent
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-stone-600 sm:text-base">
                  This frontend is being prepared independently from the backend. The current flow uses a typed mock
                  adapter so the UI can be built and refined before API integration begins.
                </p>
              </div>
            </div>

            <div className="hidden rounded-full border border-emerald-800/15 bg-emerald-700/10 px-4 py-2 text-sm font-medium text-emerald-900 sm:block">
              No auth
            </div>
          </div>
        </section>

        <section
          className={`flex flex-1 overflow-hidden ${
            isDesktopPanelVisible ? "lg:grid lg:grid-cols-[320px_minmax(0,1fr)]" : "lg:block"
          }`}
        >
          <aside
            id="chat-side-panel"
            className={`${
              isDesktopViewport ? (isDesktopPanelVisible ? "lg:flex" : "hidden") : mobilePane === "panel" ? "flex" : "hidden"
            } min-h-0 flex-col border-stone-900/10 bg-stone-950 px-6 py-6 text-stone-100 lg:border-r`}
          >
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Session</p>
                <p className="mt-2 text-sm leading-6 text-stone-300">
                  {conversationId ? `Conversation: ${conversationId}` : "No conversation created yet."}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Integration</p>
                <p className="mt-2 text-sm leading-6 text-stone-300">
                  The composer currently talks to a mock API client. Replace it later with the real REST service.
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Next steps</p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-stone-300">
                  <li>Define the final message contract.</li>
                  <li>Wire the real backend base URL through environment config.</li>
                  <li>Add streaming or polling if the agent requires it.</li>
                </ul>
              </div>
            </div>
          </aside>

          <div
            className={`${
              isDesktopViewport ? "flex" : mobilePane === "chat" ? "flex" : "hidden"
            } min-h-0 flex-1 flex-col bg-[#fffdf8]`}
          >
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6 sm:px-8">
              {messages.map((message) => {
                const isAssistant = message.role === "assistant";

                return (
                  <article
                    key={message.id}
                    className={`max-w-3xl rounded-[1.6rem] px-5 py-4 shadow-sm ${
                      isAssistant
                        ? "mr-auto bg-white text-stone-800 ring-1 ring-stone-900/8"
                        : "ml-auto bg-stone-900 text-stone-50"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em]">
                      <span className={isAssistant ? "text-stone-500" : "text-stone-300"}>{message.role}</span>
                      <span className={isAssistant ? "text-stone-400" : "text-stone-400"}>
                        {formatTimestamp(message.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-7 sm:text-[15px]">{message.content}</p>
                  </article>
                );
              })}

              {isSending ? (
                <article className="max-w-sm rounded-[1.6rem] bg-stone-200 px-5 py-4 text-sm text-stone-600 ring-1 ring-stone-900/8">
                  Waiting for mock backend response...
                </article>
              ) : null}
            </div>

            <div className="border-t border-stone-900/10 bg-[#fffaf1] px-5 py-5 sm:px-8">
              <form className="space-y-3" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                    Message
                  </span>
                  <textarea
                    className="min-h-28 w-full resize-none rounded-[1.5rem] border border-stone-900/10 bg-white px-4 py-3 text-sm leading-6 text-stone-900 outline-none transition focus:border-stone-400 focus:ring-4 focus:ring-stone-900/5"
                    name="message"
                    placeholder="Ask the assistant something. This currently posts to a mock client."
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-stone-500">
                    {error ?? "Backend auth is intentionally omitted in this first version."}
                  </p>
                  <button
                    className="inline-flex items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                    type="submit"
                    disabled={isSending || !draft.trim()}
                  >
                    {isSending ? "Sending..." : "Send message"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
