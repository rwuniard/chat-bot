import "server-only";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const AWS_REGION = process.env.COGNITO_REGION || "us-east-1";

const rawClient = new DynamoDBClient({ region: AWS_REGION });

export const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true },
});

export interface ChatHistoryTableNames {
  readonly conversations: string;
  readonly messages: string;
}

export function getTableNames(): ChatHistoryTableNames {
  return {
    conversations: process.env.CHAT_CONVERSATIONS_TABLE || "ChatConversations",
    messages: process.env.CHAT_MESSAGES_TABLE || "ChatMessages",
  };
}
