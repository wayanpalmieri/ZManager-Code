import { NextResponse } from "next/server";
import { getAllProjects } from "@/lib/claude-data";
import { clearProjectCache } from "@/lib/project-resolver";

export const dynamic = "force-dynamic";

export async function GET() {
  clearProjectCache();
  const projects = await getAllProjects();
  return NextResponse.json(projects, {
    headers: { "Cache-Control": "no-store" },
  });
}
