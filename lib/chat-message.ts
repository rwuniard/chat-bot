import type { ChatMessage, ChatRole } from "@/types/chat";

export function createChatMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    status: "complete",
  };
}
