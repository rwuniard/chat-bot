import { NextResponse } from "next/server";
import { parseBackendResponse } from "@/lib/backend-response";
import { createChatMessage } from "@/lib/chat-message";
import type { SendMessageResponse } from "@/types/chat";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

const ACTOR_ID = process.env.CHAT_ACTOR_ID ?? "user-one-495";

const BACKEND_TIMEOUT_MS = 30_000;

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
  try {
    const { conversationId, message } = parseChatRequest(await request.json());
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
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Backend request failed with status ${response.status}` },
        { status: response.status },
      );
    }

    const payload = parseBackendResponse(await response.json());

    const result: SendMessageResponse = {
      conversationId: payload.session_id,
      reply: createChatMessage("assistant", payload.result),
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
