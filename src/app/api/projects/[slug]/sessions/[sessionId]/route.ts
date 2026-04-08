import { NextResponse } from "next/server";
import { getSessionConversation } from "@/lib/claude-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; sessionId: string }> }
) {
  const { slug, sessionId } = await params;
  const messages = await getSessionConversation(slug, sessionId);
  return NextResponse.json(messages);
}
