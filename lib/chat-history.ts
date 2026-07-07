import "server-only";
import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, getTableNames } from "@/lib/dynamodb-client";
import { buildConversationTitle } from "@/lib/conversation-title";
import type { ChatMessage, ConversationSummary } from "@/types/chat";

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
    const cancellationReasons = (error as { CancellationReasons?: Array<{ Code?: string }> })
      .CancellationReasons;
    if (
      error instanceof Error &&
      error.name === "TransactionCanceledException" &&
      cancellationReasons?.[0]?.Code === "ConditionalCheckFailed"
    ) {
      throw new ConversationNotFoundError(sessionId);
    }
    throw error;
  }
}

export async function appendAssistantMessage(
  userId: string,
  sessionId: string,
  assistantMessage: ChatMessage,
): Promise<void> {
  const { messages } = getTableNames();

  try {
    await docClient.send(
      new PutCommand({
        TableName: messages,
        Item: toMessageItem(sessionId, userId, assistantMessage),
      }),
    );
  } catch (error) {
    console.error("Failed to persist assistant message", { sessionId, error });
  }
}

const MAX_CONVERSATIONS = 30;

export async function listConversationsForUser(userId: string): Promise<ConversationSummary[]> {
  const { conversations } = getTableNames();

  const result = await docClient.send(
    new QueryCommand({
      TableName: conversations,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    }),
  );

  const items = (result.Items ?? []) as ConversationSummary[];

  return items
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_CONVERSATIONS);
}

const MAX_MESSAGES = 50;

interface MessageItem {
  readonly sortKey: string;
  readonly role: ChatMessage["role"];
  readonly content: string;
  readonly status?: ChatMessage["status"];
}

function splitSortKey(sortKey: string): { createdAt: string; id: string } {
  const separatorIndex = sortKey.indexOf("#");
  return {
    createdAt: sortKey.slice(0, separatorIndex),
    id: sortKey.slice(separatorIndex + 1),
  };
}

export async function loadConversationMessages(
  userId: string,
  sessionId: string,
): Promise<ChatMessage[] | null> {
  const { conversations, messages } = getTableNames();

  const ownership = await docClient.send(
    new GetCommand({
      TableName: conversations,
      Key: { userId, sessionId },
    }),
  );

  if (!ownership.Item) {
    return null;
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: messages,
      KeyConditionExpression: "sessionId = :sessionId",
      ExpressionAttributeValues: { ":sessionId": sessionId },
      ScanIndexForward: false,
      Limit: MAX_MESSAGES,
    }),
  );

  const items = (result.Items ?? []) as MessageItem[];

  return items
    .slice()
    .reverse()
    .map((item) => {
      const { createdAt, id } = splitSortKey(item.sortKey);
      return {
        id,
        role: item.role,
        content: item.content,
        createdAt,
        status: item.status,
      };
    });
}

export async function deleteConversation(userId: string, sessionId: string): Promise<void> {
  const { conversations, messages } = getTableNames();

  try {
    await docClient.send(
      new DeleteCommand({
        TableName: conversations,
        Key: { userId, sessionId },
        ConditionExpression: "attribute_exists(sessionId)",
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      throw new ConversationNotFoundError(sessionId);
    }
    throw error;
  }

  // Best-effort from here on: the conversation row is already gone, so a
  // cleanup hiccup should never turn an already-successful delete into a
  // client-visible failure. Any messages left behind are harmless orphans -
  // unreachable once the owning conversation row no longer exists.
  try {
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const page = await docClient.send(
        new QueryCommand({
          TableName: messages,
          KeyConditionExpression: "sessionId = :sessionId",
          ExpressionAttributeValues: { ":sessionId": sessionId },
          ProjectionExpression: "sessionId, sortKey",
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );

      const items = (page.Items ?? []) as Array<{ sessionId: string; sortKey: string }>;
      for (let i = 0; i < items.length; i += 25) {
        const chunk = items.slice(i, i + 25);
        await docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [messages]: chunk.map((item) => ({
                DeleteRequest: { Key: { sessionId: item.sessionId, sortKey: item.sortKey } },
              })),
            },
          }),
        );
      }

      exclusiveStartKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey);
  } catch (error) {
    console.error("Failed to delete all messages for conversation", { sessionId, error });
  }
}
