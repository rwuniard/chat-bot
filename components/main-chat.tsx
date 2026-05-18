"use client";

import { useState } from "react";
import { SidebarControlIcon } from "@/components/sidebar-control-icon";
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

interface MainChatProps {
  isSidebarVisible: boolean;
  onSessionChange: (session: { conversationId?: string; sessionTitle?: string }) => void;
  onTogglePanel: () => void;
  shouldShowHeader: boolean;
}

function handleComposerKeyDown(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  draft: string,
  isSending: boolean,
) {
  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }

  event.preventDefault();

  if (!draft.trim() || isSending) {
    return;
  }

  event.currentTarget.form?.requestSubmit();
}

export function MainChat({
  isSidebarVisible,
  onSessionChange,
  onTogglePanel,
  shouldShowHeader,
}: MainChatProps) {
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>();

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

    const nextSessionTitle = messages.some((message) => message.role === "user")
      ? undefined
      : trimmedDraft;

    setDraft("");
    setError(undefined);
    setIsSending(true);
    setMessages((currentMessages) => [...currentMessages, userMessage]);

    if (nextSessionTitle) {
      onSessionChange({
        conversationId,
        sessionTitle: nextSessionTitle,
      });
    }

    try {
      const response = await chatApiClient.sendMessage({
        conversationId,
        message: trimmedDraft,
      });

      setConversationId(response.conversationId);
      setMessages((currentMessages) => [...currentMessages, response.reply]);
      onSessionChange({
        conversationId: response.conversationId,
        sessionTitle: nextSessionTitle,
      });
    } catch {
      setError("The message could not be sent. Retry once the backend is available.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#1f1f1f]">
      {shouldShowHeader ? (
        <div className="flex items-center gap-3 px-6 pb-5 pt-5 text-stone-300">
          <button
            aria-controls="chat-side-panel"
            aria-expanded={isSidebarVisible}
            aria-label={isSidebarVisible ? "Hide side panel" : "Show side panel"}
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

          <div className="rounded-full border border-white/8 bg-white/[0.04] px-5 py-3 text-[1.05rem] font-semibold text-white">
            Chat Bot UI <span className="text-stone-500">›</span>
          </div>
        </div>
      ) : null}

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6 sm:px-8">
        {messages.map((message) => {
          const isAssistant = message.role === "assistant";

          return (
            <article
              key={message.id}
              className={`max-w-3xl rounded-[1.6rem] px-5 py-4 shadow-sm ${
                isAssistant
                  ? "mr-auto bg-[#2c2c2c] text-stone-100 ring-1 ring-white/8"
                  : "ml-auto bg-[#303030] text-stone-50"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em]">
                <span className={isAssistant ? "text-stone-500" : "text-stone-300"}>{message.role}</span>
                <span className="text-stone-400">{formatTimestamp(message.createdAt)}</span>
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

      <div className="border-t border-white/6 bg-[#1f1f1f] px-5 py-5 sm:px-8">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
              Message
            </span>
            <textarea
              className="min-h-28 w-full resize-none rounded-[1.5rem] border border-white/8 bg-[#2a2a2a] px-4 py-3 text-sm leading-6 text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-white/18 focus:ring-4 focus:ring-white/5"
              name="message"
              placeholder="Ask the assistant something. This currently posts to a mock client."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => handleComposerKeyDown(event, draft, isSending)}
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-stone-500">
              {error ?? "Backend auth is intentionally omitted in this first version."}
            </p>
            <button
              className="inline-flex items-center justify-center rounded-full bg-stone-200 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-stone-600 disabled:text-stone-400"
              type="submit"
              disabled={isSending || !draft.trim()}
            >
              {isSending ? "Sending..." : "Send message"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
