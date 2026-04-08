import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { resolveProjectBySlug } from "@/lib/project-resolver";

export async function POST(request: Request) {
  const { slug, target } = await request.json();
  const project = resolveProjectBySlug(slug);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const projectPath = project.path;

  return new Promise<Response>((resolve) => {
    let cmd: string;
    let args: string[];

    switch (target) {
      case "vscode":
        cmd = "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code";
        args = ["--new-window", projectPath];
        break;
      case "terminal":
        cmd = "open";
        args = ["-a", "Terminal", projectPath];
        break;
      case "claude":
        cmd = "open";
        args = ["-a", "Terminal", projectPath];
        break;
      default:
        resolve(NextResponse.json({ error: "Invalid target" }, { status: 400 }));
        return;
    }

    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });

    child.on("error", (err) => {
      resolve(NextResponse.json({ error: String(err), cmd, args }, { status: 500 }));
    });

    child.unref();

    // Give it a moment to launch
    setTimeout(() => {
      resolve(NextResponse.json({ success: true, cmd, args }));
    }, 500);
  });
}
