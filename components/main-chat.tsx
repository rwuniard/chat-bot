"use client";

import type { ComponentProps, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { ChatHeaderControls } from "@/components/chat-header-controls";
import { chatApiClient } from "@/lib/chat-api";
import { createChatMessage } from "@/lib/chat-message";
import type { ChatMessage } from "@/types/chat";

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome-message",
    role: "assistant",
    content: "Hi! Ask me anything to start a conversation.",
    createdAt: "2026-05-18T18:00:00.000Z",
    status: "complete",
  },
];

const ASSISTANT_BUBBLE_CLASS = "bg-[#2c2c2c] text-stone-100 ring-1 ring-white/8";
const USER_BUBBLE_CLASS = "bg-[#1e3348] text-sky-50 ring-1 ring-sky-500/25";

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getMessageBubbleClass(isAssistant: boolean): string {
  return `mr-auto max-w-3xl rounded-[1.6rem] px-5 py-4 shadow-sm ${
    isAssistant ? ASSISTANT_BUBBLE_CLASS : USER_BUBBLE_CLASS
  }`;
}

interface MainChatProps {
  readonly isSidebarVisible: boolean;
  readonly onSessionChange: (session: { conversationId?: string; sessionTitle?: string }) => void;
  readonly onTogglePanel: () => void;
  readonly shouldShowHeader: boolean;
}

function handleComposerKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
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

type ChatFormSubmitEvent = Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0];

function getSessionTitle(messages: ChatMessage[], trimmedDraft: string): string | undefined {
  return messages.some((message) => message.role === "user") ? undefined : trimmedDraft;
}

export function MainChat({
  isSidebarVisible,
  onSessionChange,
  onTogglePanel,
  shouldShowHeader,
}: Readonly<MainChatProps>) {
  const transcriptRef = useRef<HTMLElement | null>(null);
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const transcriptElement = transcriptRef.current;
    if (!transcriptElement) {
      return;
    }

    transcriptElement.scrollTop = transcriptElement.scrollHeight;
  }, [messages, isSending]);

  async function handleSubmit(event: ChatFormSubmitEvent) {
    event.preventDefault();

    const trimmedDraft = draft.trim();
    if (!trimmedDraft || isSending) {
      return;
    }

    const userMessage = createChatMessage("user", trimmedDraft);
    const nextSessionTitle = getSessionTitle(messages, trimmedDraft);

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
    } catch (submitError) {
      console.error("Failed to send chat message", submitError);
      const message =
        submitError instanceof Error
          ? submitError.message
          : "The message could not be sent. Retry once the backend is available.";
      setError(message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#1f1f1f]">
      {shouldShowHeader ? (
        <div className="shrink-0 flex items-center gap-3 px-6 pb-5 pt-5 text-stone-300">
          <ChatHeaderControls isSidebarVisible={isSidebarVisible} onTogglePanel={onTogglePanel} />

          <div className="rounded-full border border-white/8 bg-white/4 px-5 py-3 text-[1.05rem] font-semibold text-white">
            Chat Bot UI <span className="text-stone-500">›</span>
          </div>
        </div>
      ) : null}

      <section ref={transcriptRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-end space-y-4 px-5 py-6 sm:px-8">
          {messages.map((message) => {
            const isAssistant = message.role === "assistant";

            return (
              <article key={message.id} className={getMessageBubbleClass(isAssistant)}>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em]">
                  <span className={isAssistant ? "text-stone-500" : "text-sky-400"}>{message.role}</span>
                  <span className="text-stone-400">{formatTimestamp(message.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7 sm:text-[15px]">{message.content}</p>
              </article>
            );
          })}

          {isSending ? (
            <article className="mr-auto max-w-sm rounded-[1.6rem] bg-[#2c2c2c] px-5 py-4 text-sm text-stone-400 ring-1 ring-white/8">
              Waiting for assistant response...
            </article>
          ) : null}
        </div>
      </section>

      <section className="shrink-0 border-t border-white/6 bg-[#1f1f1f] px-5 py-5 sm:px-8">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
              Message
            </span>
            <textarea
              className="min-h-28 w-full resize-none rounded-3xl border border-white/8 bg-[#2a2a2a] px-4 py-3 text-sm leading-6 text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-white/18 focus:ring-4 focus:ring-white/5"
              name="message"
              placeholder="Ask the assistant something."
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
      </section>
    </div>
  );
}
