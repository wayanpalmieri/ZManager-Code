import { NextResponse } from "next/server";
import { getDailyActivity, getTotalStats } from "@/lib/stats-reader";

export async function GET() {
  const activity = getDailyActivity(90);
  const totals = getTotalStats();
  return NextResponse.json({ activity, totals });
}
