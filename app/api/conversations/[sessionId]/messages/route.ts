import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadConversationMessages } from "@/lib/chat-history";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  const messages = await loadConversationMessages(session.userId, sessionId);

  if (messages === null) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({ messages });
}
