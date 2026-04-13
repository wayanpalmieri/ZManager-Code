import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { resolveProjects } from "@/lib/project-resolver";
import { getCuratedFolder } from "@/lib/config";
import { readGitHubRemote } from "@/lib/git-remote";
import { getVisibilities, type Visibility } from "@/lib/github-visibility";

export const dynamic = "force-dynamic";

// Returns { slug: visibility } for every project that has a github.com remote.
// Separate from /api/git because this does network I/O and is best loaded
// independently so the fast git status card doesn't wait on GitHub.
export async function GET() {
  const projects = resolveProjects();
  const curated = getCuratedFolder();
  const curatedWithSep = curated.endsWith(path.sep) ? curated : curated + path.sep;

  const slugToUrl: Record<string, string> = {};
  const urls: string[] = [];

  for (const project of projects) {
    const resolved = path.resolve(project.path);
    if (
      (resolved !== curated && !resolved.startsWith(curatedWithSep)) ||
      !fs.existsSync(path.join(resolved, ".git"))
    ) {
      continue;
    }
    const url = readGitHubRemote(resolved);
    if (url) {
      slugToUrl[project.slug] = url;
      urls.push(url);
    }
  }

  const visibilityByUrl = await getVisibilities(urls);
  const out: Record<string, Visibility> = {};
  for (const [slug, url] of Object.entries(slugToUrl)) {
    out[slug] = visibilityByUrl[url] ?? "unknown";
  }

  return NextResponse.json(out);
}

