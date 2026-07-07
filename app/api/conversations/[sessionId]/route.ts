import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ConversationNotFoundError, deleteConversation } from "@/lib/chat-history";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  try {
    await deleteConversation(session.userId, sessionId);
  } catch (error) {
    if (error instanceof ConversationNotFoundError) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    throw error;
  }

  return new NextResponse(null, { status: 204 });
}
