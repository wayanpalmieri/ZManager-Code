import { NextResponse } from "next/server";
import { analyzeProjects } from "@/lib/project-analyzer";

export const dynamic = "force-dynamic";

export async function GET() {
  const insights = await analyzeProjects();
  return NextResponse.json(insights, {
    headers: { "Cache-Control": "no-store" },
  });
}
