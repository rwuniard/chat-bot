import { NextResponse } from "next/server";
import type { ChatMessage, SendMessageResponse } from "@/types/chat";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

const ACTOR_ID = "user-one-495";

interface ApiGatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

interface BackendChatBody {
  result: string;
  session_id: string;
}

function buildMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    status: "complete",
  };
}

function parseBackendResponse(payload: unknown): BackendChatBody {
  if (typeof payload !== "object" || payload === null) {
    throw new TypeError("Chat API returned an unexpected response shape");
  }

  const gateway = payload as ApiGatewayResponse;

  if (typeof gateway.body !== "string") {
    throw new TypeError("Chat API response is missing body");
  }

  const parsed = JSON.parse(gateway.body) as BackendChatBody;

  if (typeof parsed.result !== "string") {
    throw new TypeError("Chat API response body is missing result");
  }

  return parsed;
}

export async function POST(request: Request) {
  try {
    const { conversationId, message } = (await request.json()) as {
      conversationId?: string;
      message: string;
    };

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const sessionId = conversationId ?? crypto.randomUUID();

    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        session_id: sessionId,
        actor_id: ACTOR_ID,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Backend request failed with status ${response.status}` },
        { status: response.status },
      );
    }

    const payload = parseBackendResponse(await response.json());

    const result: SendMessageResponse = {
      conversationId: payload.session_id ?? sessionId,
      reply: buildMessage("assistant", payload.result),
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
