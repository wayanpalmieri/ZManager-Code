import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/config";
import { clearProjectCache } from "@/lib/project-resolver";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function PUT(request: Request) {
  const body = await request.json();

  if (body.projectsFolder) {
    // Validate the path exists
    if (!fs.existsSync(body.projectsFolder)) {
      return NextResponse.json({ error: "Directory does not exist" }, { status: 400 });
    }
    if (!fs.statSync(body.projectsFolder).isDirectory()) {
      return NextResponse.json({ error: "Path is not a directory" }, { status: 400 });
    }
  }

  saveSettings(body);
  clearProjectCache();
  return NextResponse.json(getSettings());
}
