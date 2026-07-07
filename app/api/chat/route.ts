import { NextResponse, after } from "next/server";
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import { getSession } from "@/lib/session";
import { createChatMessage } from "@/lib/chat-message";
import {
  ConversationNotFoundError,
  appendAssistantMessage,
  appendUserMessageToConversation,
  createConversationWithFirstMessage,
} from "@/lib/chat-history";

// This route is a pass-through pipe, not a request/response transform: it never
// buffers the agent's full reply before responding. Whatever bytes the agent
// produces get forwarded to the browser as they arrive, so the chat UI can
// render tokens as the model generates them instead of waiting for the whole
// answer. The one exception is the current agent, which still returns a single
// JSON payload (no `yield` in its entrypoint yet) - see the `isEventStream`
// branch below for how that's handled without special-casing the client.

const AGENT_RUNTIME_ARN =
  process.env.AGENT_RUNTIME_ARN ||
  "arn:aws:bedrock-agentcore:us-east-1:850652371396:runtime/simple_langchain_agent-Qgc53c8gbf";

const AWS_REGION = process.env.COGNITO_REGION || "us-east-1";

const ACTOR_ID = process.env.CHAT_ACTOR_ID || "user-one-495";

// Dev-only escape hatch: point at a `docker run`'d agent's /invocations
// endpoint (e.g. http://localhost:8080/invocations) to test without AWS.
// Never set this in Amplify Console - amplify.yml doesn't bake it into
// .env.production, so it's inert in any deployed environment regardless.
const LOCAL_AGENT_URL = process.env.LOCAL_AGENT_URL;

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

/**
 * Extracts the text payload from one `\n\n`-delimited SSE frame. AgentCore
 * JSON-encodes each yielded chunk, so a frame's `data:` line is usually a
 * quoted JSON string; fall back to the raw line for agents that emit plain text.
 *
 * This is the only place that needs to know SSE is the wire format - once a
 * frame is decoded to plain text here, everything downstream (the browser
 * included) just deals with a flat stream of characters.
 */
function decodeSseFrame(frame: string): string | null {
  const dataLines = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  if (dataLines.length === 0) {
    return null;
  }

  const data = dataLines.join("\n");
  try {
    const parsed = JSON.parse(data);
    return typeof parsed === "string" ? parsed : JSON.stringify(parsed);
  } catch {
    return data;
  }
}

/**
 * Reads the agent's SSE body and forwards each decoded chunk to our own
 * response stream as soon as it arrives - this is what actually makes the
 * reply appear token-by-token in the browser instead of all at once.
 *
 * SSE frames are separated by a blank line (`\n\n`), but network reads don't
 * respect that boundary - one `reader.read()` can deliver half a frame, or
 * several frames at once. `buffer` accumulates decoded text across reads and
 * only ever emits *complete* frames; whatever's left after the last `\n\n`
 * is carried over to be completed by the next read (or flushed at EOF below).
 */
async function pipeEventStream(
  webStream: ReadableStream<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<string> {
  const reader = webStream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let accumulated = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const text = decodeSseFrame(frame);
      if (text) {
        controller.enqueue(encoder.encode(text));
        accumulated += text;
      }
    }
  }

  if (buffer.trim()) {
    const text = decodeSseFrame(buffer);
    if (text) {
      controller.enqueue(encoder.encode(text));
      accumulated += text;
    }
  }

  return accumulated;
}

/**
 * Buffers a whole Web `ReadableStream` into a string. Used only for the
 * non-streaming fallback below, where we need the complete payload up front
 * to JSON-parse it - equivalent to the AWS SDK's `.transformToString()`, but
 * written against the standard Web Streams API so it also works on a plain
 * `fetch()` response body from a local agent (see `invokeLocalAgent`), which
 * has no SDK-specific helpers of its own.
 */
async function readWebStreamToString(webStream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = webStream.getReader();
  const decoder = new TextDecoder();
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  return text;
}

// Common shape both invocation paths reduce to, so everything below this point
// (streaming-vs-buffered detection, SSE decoding, response assembly) is written
// once and works identically regardless of where the reply came from.
interface AgentInvocation {
  readonly contentType: string;
  readonly bodyStream: ReadableStream<Uint8Array>;
}

async function invokeAgentCore(message: string, sessionId: string): Promise<AgentInvocation> {
  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: AGENT_RUNTIME_ARN,
    runtimeSessionId: sessionId,
    payload: new TextEncoder().encode(
      JSON.stringify({ message, session_id: sessionId, actor_id: ACTOR_ID }),
    ),
  });

  const agentResponse = await client.send(command);
  if (!agentResponse.response) {
    throw new Error("AgentCore returned an empty response");
  }

  return {
    contentType: agentResponse.contentType ?? "application/json",
    bodyStream: agentResponse.response.transformToWebStream(),
  };
}

/**
 * Talks directly to a `docker run`'d agent's /invocations endpoint (see
 * LOCAL_AGENT_URL below), bypassing AWS entirely. The local server run by the
 * bedrock_agentcore SDK serves the same contract as the deployed runtime -
 * JSON body in, and its Content-Type header tells us JSON vs SSE out, exactly
 * like AgentCore's `contentType` field - so no extra logic is needed here to
 * pick between the two response shapes.
 */
async function invokeLocalAgent(
  message: string,
  sessionId: string,
  url: string,
): Promise<AgentInvocation> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId, actor_id: ACTOR_ID }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Local agent request failed with status ${response.status}`);
  }

  return {
    contentType: response.headers.get("content-type") ?? "application/json",
    bodyStream: response.body,
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let conversationId: string | undefined;
  let message: string;
  try {
    ({ conversationId, message } = parseChatRequest(await request.json()));
  } catch (error) {
    if (error instanceof TypeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : "Invalid request body";
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  // conversationId doubles as the AgentCore session id, so a fresh chat and a
  // continued one share the same identifier end to end.
  const sessionId = conversationId ?? crypto.randomUUID();
  const userMessage = createChatMessage("user", message);

  // Persisted before the agent is ever invoked, so the message survives even
  // if the agent call below fails. An ownership mismatch is the one failure
  // that's surfaced to the client - anything else is logged and swallowed,
  // matching the "best-effort" persistence policy in the design doc.
  try {
    if (conversationId) {
      await appendUserMessageToConversation(session.userId, sessionId, userMessage);
    } else {
      await createConversationWithFirstMessage(session.userId, sessionId, userMessage);
    }
  } catch (error) {
    if (error instanceof ConversationNotFoundError) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    console.error("Failed to persist user message", { sessionId, error });
  }

  // This call only reserves the connection to the agent - for a streaming
  // agent, invokeAgentCore/invokeLocalAgent resolve as soon as the *first*
  // byte is available, not when the whole reply is done. Failures here (bad
  // auth, agent unreachable, empty response) happen before we've committed to
  // a 200, so they can still be reported as a normal JSON error response.
  let invocation: AgentInvocation;
  try {
    invocation = LOCAL_AGENT_URL
      ? await invokeLocalAgent(message, sessionId, LOCAL_AGENT_URL)
      : await invokeAgentCore(message, sessionId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }

  // The agent's Content-Type is the single signal for which shape it sent:
  // text/event-stream once its entrypoint yields chunks, application/json
  // (or plain text) while it still returns one value. Everything past this
  // point exists to make both cases look identical to the browser.
  const isEventStream = invocation.contentType.includes("event-stream");

  // From here on we're building our *own* response body, decoupled from how
  // the agent replied. Once this ReadableStream is handed to `new Response`
  // below, any bytes enqueued into `controller` are flushed to the browser
  // immediately - that's what turns "the agent produced a word" into "the
  // user sees a word appear," rather than waiting for `POST` to return.
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantContent = "";
      try {
        if (isEventStream) {
          assistantContent = await pipeEventStream(invocation.bodyStream, controller);
        } else {
          // Agent isn't streaming yet (still returns one JSON/text payload) -
          // buffer it and deliver as a single chunk so the client code path
          // is identical either way. Once the Python entrypoint switches to
          // `yield`, contentType flips to event-stream and this branch stops
          // being hit - no client-side change needed when that happens.
          const raw = await readWebStreamToString(invocation.bodyStream);
          let content = raw;
          try {
            const parsed = JSON.parse(raw);
            if (typeof parsed === "string") {
              content = parsed;
            }
          } catch {
            // response is plain text, use as-is
          }
          controller.enqueue(new TextEncoder().encode(content));
          assistantContent = content;
        }
      } catch (error) {
        // The 200 status and headers below are already sent by this point,
        // so a failure here can't become a JSON error response - controller.error()
        // aborts the fetch body on the client, which the UI treats as a send failure.
        controller.error(error);
        return;
      }
      controller.close();

      // Deferred until after the response is fully sent - `after()` keeps
      // this write alive even on platforms that would otherwise freeze/tear
      // down execution the instant the HTTP response finishes, which a bare
      // fire-and-forget promise here would be vulnerable to.
      after(async () => {
        const assistantMessage = createChatMessage("assistant", assistantContent);
        await appendAssistantMessage(session.userId, sessionId, assistantMessage);
      });
    },
  });

  // conversationId now travels as a header instead of in a JSON body, since
  // the body itself is the raw reply text (streamed or not) - there's no
  // JSON envelope left to put it in.
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": sessionId,
      "Cache-Control": "no-store",
    },
  });
}
