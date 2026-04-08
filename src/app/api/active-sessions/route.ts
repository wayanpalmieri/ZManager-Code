import { NextResponse } from "next/server";
import { getActiveSessions } from "@/lib/active-session-monitor";

export async function GET() {
  const sessions = getActiveSessions();
  return NextResponse.json(sessions);
}
