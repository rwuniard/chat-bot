"use client";

import type { ComponentProps, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChatHeaderControls } from "@/components/chat-header-controls";
import { parseAssistantContent, type ParsedAssistantContent } from "@/lib/assistant-content";
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

// These live at module scope, not inside the component, specifically so the
// array-method callback (`.map`/`.filter`) is only ever lexically nested one
// level inside a small top-level function - not several levels deep inside
// handleSubmit's closures. Inlining this logic at each setMessages call site
// is what previously nested a `.map()` five functions deep.
function updateMessageById(
  messages: ChatMessage[],
  id: string,
  updater: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  return messages.map((message) => (message.id === id ? updater(message) : message));
}

function removeMessageById(messages: ChatMessage[], id: string): ChatMessage[] {
  return messages.filter((message) => message.id !== id);
}

// Small factories instead of inlining `(message) => ({ ...message, content })`
// at each call site - the returned arrow's *definition* site is inside this
// shallow top-level function, so passing the result into a deeply-nested
// closure doesn't drag the arrow's own nesting depth down with it.
function withContent(content: string) {
  return (message: ChatMessage): ChatMessage => ({ ...message, content });
}

function withStatus(status: ChatMessage["status"]) {
  return (message: ChatMessage): ChatMessage => ({ ...message, status });
}

const WAITING_PLACEHOLDER = (
  <span className="text-stone-400">Waiting for assistant response...</span>
);

/**
 * Renders one message's body. Extracted out of the transcript's `.map()` (and
 * written as early returns rather than a chained/nested ternary) specifically
 * to keep this branching in its own small function instead of adding to the
 * cognitive complexity of the callback that renders the whole list.
 */
function MessageBody({ message }: { readonly message: ChatMessage }) {
  const isAwaitingFirstChunk = message.status === "pending" && !message.content;
  if (isAwaitingFirstChunk) {
    return WAITING_PLACEHOLDER;
  }

  // Only assistant text can contain <thinking> blocks (the agent's own
  // reasoning before/between tool calls) - user messages never need this
  // split.
  if (message.role !== "assistant") {
    return <ReactMarkdown>{message.content}</ReactMarkdown>;
  }

  const parsed = parseAssistantContent(message.content);
  const hasAnswerText = parsed.answer.length > 0;

  return (
    <>
      {parsed.reasoning ? <ReasoningPanel parsed={parsed} hasAnswerText={hasAnswerText} /> : null}
      <AnswerArea parsed={parsed} hasAnswerText={hasAnswerText} />
    </>
  );
}

function ReasoningPanel({
  parsed,
  hasAnswerText,
}: {
  readonly parsed: ParsedAssistantContent;
  readonly hasAnswerText: boolean;
}) {
  return (
    // `open` re-forces itself only when this boolean actually flips between
    // renders (React leaves a manually-toggled <details> alone otherwise) -
    // so it stays open while the agent is only "thinking" with no answer
    // yet, then auto-collapses the moment real answer text shows up, without
    // fighting a reader who's already toggled it.
    <details
      open={!hasAnswerText}
      className="mb-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-2 text-xs not-prose"
    >
      <summary className="cursor-pointer select-none font-semibold uppercase tracking-[0.14em] text-stone-500">
        {parsed.isReasoningInProgress ? "Thinking..." : "Show reasoning"}
      </summary>
      <div className="mt-2 whitespace-pre-wrap text-stone-400">{parsed.reasoning}</div>
    </details>
  );
}

function AnswerArea({
  parsed,
  hasAnswerText,
}: {
  readonly parsed: ParsedAssistantContent;
  readonly hasAnswerText: boolean;
}) {
  if (hasAnswerText) {
    return <ReactMarkdown>{parsed.answer}</ReactMarkdown>;
  }
  // Reasoning is still streaming in (rendered by ReasoningPanel above) and
  // there's no answer text to show yet - nothing more to render here.
  if (parsed.reasoning) {
    return null;
  }
  return WAITING_PLACEHOLDER;
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
    // The assistant bubble is added to the transcript *before* any reply text
    // exists, with an id we hold onto so later chunks know which message to
    // update. This is what lets the same bubble morph from "waiting..." to
    // streamed content in place, instead of appending a new message once the
    // full reply comes back.
    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    setDraft("");
    setError(undefined);
    setIsSending(true);
    setMessages((currentMessages) => [...currentMessages, userMessage, assistantMessage]);

    if (nextSessionTitle) {
      onSessionChange({
        conversationId,
        sessionTitle: nextSessionTitle,
      });
    }

    // Accumulated outside React state because chunks can arrive faster than
    // re-renders settle; state always gets the up-to-date full string built
    // from this, rather than each update depending on the previous render's
    // `message.content` (which could be stale mid-stream).
    let assistantContent = "";

    function appendChunk(chunk: string) {
      assistantContent += chunk;
      setMessages((currentMessages) =>
        updateMessageById(currentMessages, assistantMessageId, withContent(assistantContent)),
      );
    }

    try {
      // sendMessage doesn't resolve until the stream ends - appendChunk is
      // what drives the visible, incremental typing effect while this is in
      // flight.
      const result = await chatApiClient.sendMessage(
        { conversationId, message: trimmedDraft },
        { onChunk: appendChunk },
      );

      setConversationId(result.conversationId);
      setMessages((currentMessages) =>
        updateMessageById(currentMessages, assistantMessageId, withStatus("complete")),
      );
      onSessionChange({
        conversationId: result.conversationId,
        sessionTitle: nextSessionTitle,
      });
    } catch (submitError) {
      console.error("Failed to send chat message", submitError);
      const message =
        submitError instanceof Error
          ? submitError.message
          : "The message could not be sent. Retry once the backend is available.";
      setError(message);
      // Drop the placeholder/partial bubble on failure rather than leaving a
      // truncated reply in the transcript - the error banner is the record
      // of what happened, matching how a fully-failed send behaved before.
      setMessages((currentMessages) => removeMessageById(currentMessages, assistantMessageId));
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
                <div className="prose prose-invert prose-sm max-w-none text-sm leading-7 sm:text-[15px]">
                  <MessageBody message={message} />
                </div>
              </article>
            );
          })}
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
            <p className="text-sm text-stone-500">{error}</p>
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
