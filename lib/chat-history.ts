import "server-only";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, getTableNames } from "@/lib/dynamodb-client";
import { buildConversationTitle } from "@/lib/conversation-title";
import type { ChatMessage } from "@/types/chat";

export class ConversationNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Conversation ${sessionId} was not found for this user`);
    this.name = "ConversationNotFoundError";
  }
}

function toMessageItem(sessionId: string, userId: string, message: ChatMessage) {
  return {
    sessionId,
    sortKey: `${message.createdAt}#${message.id}`,
    userId,
    role: message.role,
    content: message.content,
    status: message.status ?? "complete",
  };
}

export async function createConversationWithFirstMessage(
  userId: string,
  sessionId: string,
  userMessage: ChatMessage,
): Promise<void> {
  const { conversations, messages } = getTableNames();
  const now = new Date().toISOString();

  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: conversations,
            Item: {
              userId,
              sessionId,
              title: buildConversationTitle(userMessage.content),
              createdAt: now,
              updatedAt: now,
            },
            ConditionExpression: "attribute_not_exists(sessionId)",
          },
        },
        {
          Put: {
            TableName: messages,
            Item: toMessageItem(sessionId, userId, userMessage),
          },
        },
      ],
    }),
  );
}

export async function appendUserMessageToConversation(
  userId: string,
  sessionId: string,
  userMessage: ChatMessage,
): Promise<void> {
  const { conversations, messages } = getTableNames();
  const now = new Date().toISOString();

  try {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: conversations,
              Key: { userId, sessionId },
              UpdateExpression: "SET updatedAt = :now",
              ConditionExpression: "attribute_exists(sessionId)",
              ExpressionAttributeValues: { ":now": now },
            },
          },
          {
            Put: {
              TableName: messages,
              Item: toMessageItem(sessionId, userId, userMessage),
            },
          },
        ],
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TransactionCanceledException") {
      throw new ConversationNotFoundError(sessionId);
    }
    throw error;
  }
}
