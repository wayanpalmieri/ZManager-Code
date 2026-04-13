import { spawnSync } from "child_process";

// Read the origin remote URL and canonicalize it to
// https://github.com/<owner>/<repo> form. Returns null for repos with no
// origin or a non-github remote — the UI only wants links it can open.
export function readGitHubRemote(repoPath: string): string | null {
  const res = spawnSync(
    "git",
    ["-C", repoPath, "config", "--get", "remote.origin.url"],
    { encoding: "utf-8", timeout: 2000 }
  );
  if (res.status !== 0) return null;
  const raw = res.stdout.trim();
  if (!raw) return null;

  const stripped = raw.replace(/\.git$/, "");

  let m = stripped.match(/^git@github\.com:([\w.-]+)\/([\w.-]+)$/);
  if (m) return `https://github.com/${m[1]}/${m[2]}`;

  m = stripped.match(/^ssh:\/\/git@github\.com\/([\w.-]+)\/([\w.-]+)$/);
  if (m) return `https://github.com/${m[1]}/${m[2]}`;

  m = stripped.match(/^https?:\/\/(?:[^@/]+@)?github\.com\/([\w.-]+)\/([\w.-]+)$/);
  if (m) return `https://github.com/${m[1]}/${m[2]}`;

  return null;
}
