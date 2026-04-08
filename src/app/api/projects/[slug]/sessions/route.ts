import { NextResponse } from "next/server";
import { resolveProjectBySlug } from "@/lib/project-resolver";
import { getSessionsForProject } from "@/lib/session-parser";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const project = resolveProjectBySlug(slug);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const sessions = project.claudeDataPath
    ? await getSessionsForProject(project.claudeDataPath)
    : [];

  return NextResponse.json(sessions);
}
