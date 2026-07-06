const THINKING_OPEN = "<thinking>";
const THINKING_CLOSE = "</thinking>";

export interface ParsedAssistantContent {
  readonly reasoning: string | null;
  readonly answer: string;
  readonly isReasoningInProgress: boolean;
}

/**
 * Splits raw assistant text into the model's <thinking>...</thinking> blocks
 * (its own reasoning, emitted inline by the agent's prompt) and everything
 * else (the actual answer). Called on the full accumulated text on every
 * render, not per-chunk, so a tag split across two stream chunks is never a
 * problem - by render time either the closing tag has arrived or it hasn't.
 *
 * A ReAct loop can call multiple tools, each preceded by its own <thinking>
 * block, so this collects all of them rather than assuming just one.
 */
export function parseAssistantContent(raw: string): ParsedAssistantContent {
  const reasoningBlocks: string[] = [];

  let answer = raw.replace(
    new RegExp(String.raw`${THINKING_OPEN}([\s\S]*?)${THINKING_CLOSE}`, "g"),
    (_match, inner: string) => {
      reasoningBlocks.push(inner.trim());
      return "";
    },
  );

  // A <thinking> block still streaming in (no closing tag yet) belongs in the
  // reasoning panel too, not dangling in the visible answer.
  const openIndex = answer.indexOf(THINKING_OPEN);
  const isReasoningInProgress = openIndex !== -1;
  if (isReasoningInProgress) {
    reasoningBlocks.push(answer.slice(openIndex + THINKING_OPEN.length).trim());
    answer = answer.slice(0, openIndex);
  }

  return {
    reasoning: reasoningBlocks.length > 0 ? reasoningBlocks.join("\n\n") : null,
    answer: answer.trim(),
    isReasoningInProgress,
  };
}
