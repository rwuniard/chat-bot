export interface BackendChatBody {
  readonly result: string;
  readonly session_id: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseBackendResponse(payload: unknown): BackendChatBody {
  if (!isRecord(payload)) {
    throw new TypeError("Chat API returned an unexpected response shape");
  }

  const body = payload.body;
  if (typeof body !== "string") {
    throw new TypeError("Chat API response is missing body");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new TypeError(`Chat API response body is not valid JSON: ${message}`);
  }

  if (!isRecord(parsed)) {
    throw new TypeError("Chat API response body is not an object");
  }

  if (typeof parsed.result !== "string") {
    throw new TypeError("Chat API response body is missing result");
  }

  if (typeof parsed.session_id !== "string") {
    throw new TypeError("Chat API response body is missing session_id");
  }

  return {
    result: parsed.result,
    session_id: parsed.session_id,
  };
}
