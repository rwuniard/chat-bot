import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import { authOptions } from "@/lib/auth";
import { createChatMessage } from "@/lib/chat-message";
import type { SendMessageResponse } from "@/types/chat";

const AGENT_RUNTIME_ARN =
  process.env.AGENT_RUNTIME_ARN ??
  "arn:aws:bedrock-agentcore:us-east-1:850652371396:runtime/simple_langchain_agent-Qgc53c8gbf";

const AWS_REGION = process.env.AWS_REGION ?? "us-east-1";

const ACTOR_ID = process.env.CHAT_ACTOR_ID ?? "user-one-495";

const client = new BedrockAgentCoreClient({ region: AWS_REGION });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseChatRequest(payload: unknown): { conversationId?: string; message: string } {
  if (!isRecord(payload)) {
    throw new TypeError("Request body must be a JSON object");
  }

  const { conversationId, message } = payload;

  if (conversationId !== undefined && typeof conversationId !== "string") {
    throw new TypeError("conversationId must be a string");
  }

  if (typeof message !== "string" || !message.trim()) {
    throw new TypeError("Message is required");
  }

  return { conversationId, message };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { conversationId, message } = parseChatRequest(await request.json());
    const sessionId = conversationId ?? crypto.randomUUID();

    const command = new InvokeAgentRuntimeCommand({
      agentRuntimeArn: AGENT_RUNTIME_ARN,
      runtimeSessionId: sessionId,
      payload: new TextEncoder().encode(
        JSON.stringify({ message, session_id: sessionId, actor_id: ACTOR_ID }),
      ),
    });

    const agentResponse = await client.send(command);
    const raw = await agentResponse.response?.transformToString();

    if (!raw) {
      throw new Error("AgentCore returned an empty response");
    }

    let content = raw;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") {
        content = parsed;
      }
    } catch {
      // response is plain text, use as-is
    }

    const result: SendMessageResponse = {
      conversationId: sessionId,
      reply: createChatMessage("assistant", content),
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TypeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
