import { NextResponse } from "next/server";
import { spawn } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { resolveProjectBySlug } from "@/lib/project-resolver";
import { getCuratedFolder } from "@/lib/config";

// POSIX single-quote a string for safe interpolation into /bin/sh.
function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

// Escape a string for inclusion inside an AppleScript double-quoted string.
function asEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// Windows shell metacharacters that can break argument boundaries when shell=true.
const WIN_UNSAFE = /["<>|&^()%!]/;

// Session IDs in ~/.claude/projects/**/*.jsonl are UUID-like. Same charset
// we already accept in the session conversation route.
const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/;
const PROMPT_MAX_LEN = 4000;

export async function POST(request: Request) {
  const { slug, target, sessionId, promptText } = await request.json();

  if (typeof slug !== "string" || typeof target !== "string") {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  // sessionId and promptText are only meaningful for target=claude and
  // must pass strict validation before any shell interpolation.
  if (sessionId !== undefined) {
    if (typeof sessionId !== "string" || !SESSION_ID_RE.test(sessionId)) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }
  }
  if (promptText !== undefined) {
    if (typeof promptText !== "string" || promptText.length > PROMPT_MAX_LEN) {
      return NextResponse.json({ error: "Invalid promptText" }, { status: 400 });
    }
  }

  const project = resolveProjectBySlug(slug);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const projectPath = project.path;
  const curated = getCuratedFolder();
  const curatedWithSep = curated.endsWith(path.sep) ? curated : curated + path.sep;
  const resolvedPath = path.resolve(projectPath);
  if (
    (resolvedPath !== curated && !resolvedPath.startsWith(curatedWithSep)) ||
    !fs.existsSync(resolvedPath)
  ) {
    return NextResponse.json({ error: "Invalid project path" }, { status: 403 });
  }

  const platform = os.platform(); // 'darwin' | 'win32' | 'linux'

  // `claude` CLI modifiers. On POSIX shells we interpolate into a single
  // command string (osascript/bash -c need that), so promptText must be
  // shQuote'd; sessionId is regex-validated so it's safe literal.
  const claudeSuffixPosix = sessionId
    ? ` --resume ${sessionId}`
    : promptText
    ? ` ${shQuote(promptText)}`
    : "";

  return new Promise<Response>((resolve) => {
    let cmd: string;
    let args: string[];
    let useShell = false;

    if (platform === "darwin") {
      // macOS
      switch (target) {
        case "vscode":
          cmd = "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code";
          args = ["--new-window", resolvedPath];
          break;
        case "terminal":
          cmd = "open";
          args = ["-a", "Terminal", resolvedPath];
          break;
        case "claude": {
          // Build shell command with POSIX-quoted path, then escape for AppleScript string.
          const shellCmd = `cd ${shQuote(resolvedPath)} && claude${claudeSuffixPosix}`;
          cmd = "osascript";
          args = [
            "-e", `tell application "Terminal" to activate`,
            "-e", `tell application "Terminal" to do script "${asEscape(shellCmd)}"`,
          ];
          break;
        }
        default:
          resolve(NextResponse.json({ error: "Invalid target" }, { status: 400 }));
          return;
      }
    } else if (platform === "win32") {
      // Windows: spawn with shell=true concatenates args via cmd.exe, so reject
      // any path containing shell metacharacters to prevent argument injection.
      if (WIN_UNSAFE.test(resolvedPath)) {
        resolve(NextResponse.json({ error: "Path contains unsafe characters" }, { status: 400 }));
        return;
      }
      switch (target) {
        case "vscode":
          cmd = "code";
          args = ["--new-window", resolvedPath];
          useShell = true; // need shell for PATH resolution of code.cmd
          break;
        case "terminal":
          cmd = "wt.exe";
          args = ["-d", resolvedPath];
          break;
        case "claude": {
          // Pass resume/prompt as argv entries rather than string-concat so
          // cmd.exe doesn't re-interpret any characters. Apply the same
          // WIN_UNSAFE gate to promptText as we do for paths.
          const winSuffix: string[] = [];
          if (sessionId) {
            winSuffix.push("--resume", sessionId);
          } else if (promptText) {
            if (WIN_UNSAFE.test(promptText)) {
              resolve(NextResponse.json({ error: "Prompt contains unsafe characters" }, { status: 400 }));
              return;
            }
            winSuffix.push(promptText);
          }
          cmd = "wt.exe";
          args = ["-d", resolvedPath, "cmd", "/k", "claude", ...winSuffix];
          break;
        }
        default:
          resolve(NextResponse.json({ error: "Invalid target" }, { status: 400 }));
          return;
      }
    } else {
      // Linux
      switch (target) {
        case "vscode":
          cmd = "code";
          args = ["--new-window", resolvedPath];
          useShell = true;
          break;
        case "terminal":
          cmd = "x-terminal-emulator";
          args = ["--working-directory", resolvedPath];
          break;
        case "claude":
          // Pass bash + -c + script as separate argv entries so projectPath is
          // only interpolated inside a POSIX-quoted literal.
          cmd = "x-terminal-emulator";
          args = [
            "-e", "bash", "-c",
            `cd ${shQuote(resolvedPath)} && claude${claudeSuffixPosix}; exec bash`,
          ];
          break;
        default:
          resolve(NextResponse.json({ error: "Invalid target" }, { status: 400 }));
          return;
      }
    }

    const child = spawn(cmd, args, { detached: true, stdio: "ignore", shell: useShell });

    child.on("error", (err) => {
      resolve(NextResponse.json({ error: String(err), platform, cmd }, { status: 500 }));
    });

    child.unref();

    setTimeout(() => {
      resolve(NextResponse.json({ success: true, platform }));
    }, 500);
  });
}
