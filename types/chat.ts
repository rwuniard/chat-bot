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
