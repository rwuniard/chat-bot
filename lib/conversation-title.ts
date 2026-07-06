const MAX_TITLE_LENGTH = 60;

export function buildConversationTitle(message: string): string {
  const trimmed = message.trim();

  if (trimmed.length <= MAX_TITLE_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`;
}
