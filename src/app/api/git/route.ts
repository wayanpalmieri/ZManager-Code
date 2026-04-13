import { NextResponse } from "next/server";
import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import { resolveProjects } from "@/lib/project-resolver";
import { getCuratedFolder } from "@/lib/config";
import { readGitHubRemote } from "@/lib/git-remote";

export const dynamic = "force-dynamic";

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  dirty: number;
  hasGit: boolean;
  remoteUrl: string | null;
}

// Returns a map of slug -> git status for every resolvable project. We run
// `git status --porcelain=v2 -b` per project in parallel via spawnSync; each
// call is fast (~50ms) and reads only the project's own .git — path is
// constrained to the curated folder by the resolver and re-verified here.
export async function GET() {
  const projects = resolveProjects();
  const curated = getCuratedFolder();
  const curatedWithSep = curated.endsWith(path.sep) ? curated : curated + path.sep;

  const out: Record<string, GitStatus> = {};

  for (const project of projects) {
    const resolved = path.resolve(project.path);
    if (
      (resolved !== curated && !resolved.startsWith(curatedWithSep)) ||
      !fs.existsSync(path.join(resolved, ".git"))
    ) {
      out[project.slug] = { branch: "", ahead: 0, behind: 0, dirty: 0, hasGit: false, remoteUrl: null };
      continue;
    }

    const status = readGitStatus(resolved);
    status.remoteUrl = readGitHubRemote(resolved);
    out[project.slug] = status;
  }

  return NextResponse.json(out);
}

function readGitStatus(repoPath: string): GitStatus {
  const res = spawnSync(
    "git",
    ["-C", repoPath, "status", "--porcelain=v2", "-b", "--untracked-files=no"],
    { encoding: "utf-8", timeout: 2000 }
  );
  if (res.status !== 0 || !res.stdout) {
    return { branch: "", ahead: 0, behind: 0, dirty: 0, hasGit: true, remoteUrl: null };
  }

  let branch = "";
  let ahead = 0;
  let behind = 0;
  let dirty = 0;

  for (const line of res.stdout.split("\n")) {
    if (line.startsWith("# branch.head ")) {
      branch = line.slice("# branch.head ".length).trim();
    } else if (line.startsWith("# branch.ab ")) {
      const m = line.match(/# branch\.ab \+(\d+) -(\d+)/);
      if (m) {
        ahead = Number(m[1]);
        behind = Number(m[2]);
      }
    } else if (line.length > 0 && !line.startsWith("#")) {
      dirty++;
    }
  }

  // Empty repo / detached HEAD on an unborn branch: branch may be "(detached)"
  if (branch === "(detached)") branch = "";

  return { branch, ahead, behind, dirty, hasGit: true, remoteUrl: null };
}

