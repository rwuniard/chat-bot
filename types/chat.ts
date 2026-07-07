export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  readonly id: string;
  readonly role: ChatRole;
  readonly content: string;
  readonly createdAt: string;
  readonly status?: "pending" | "complete" | "error";
}

export interface SendMessageRequest {
  readonly conversationId?: string;
  readonly message: string;
}

export interface ConversationSummary {
  readonly sessionId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
