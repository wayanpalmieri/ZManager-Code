import fs from "fs";
import path from "path";
import { safeParse } from "./safe-json";

// Best-effort "what is this project" summary, drawn from whichever manifest
// or README is on disk. Ordered: most authoritative first (hand-written
// description fields) before falling back to README prose.
//
// Returns null when nothing useful is found so callers can fall back to the
// session-derived description. All reads are lstat-gated to skip symlinks,
// size-capped at 64KB so a pathological README can't stall a page render,
// and silently ignore any error — project descriptions are nice-to-have,
// never load-bearing.
const MAX_BYTES = 64 * 1024;
const MAX_LEN = 120;

// Common scaffolded-project boilerplate that carries zero signal about
// what the project actually is. When we see these, skip to the next
// description source instead of showing the user a meaningless string.
const BOILERPLATE_PATTERNS = [
  /bootstrapped with create-next-app/i,
  /generated with the vue cli/i,
  /created with angular cli/i,
  /create react app/i,
  /this is a starter template/i,
  /^getting started$/i,
  /^todo$/i,
];

function isBoilerplate(text: string): boolean {
  return BOILERPLATE_PATTERNS.some((re) => re.test(text));
}

export function readProjectDescription(projectPath: string): string | null {
  const candidates = [
    fromJsonField(path.join(projectPath, "package.json"), "description"),
    fromTomlField(path.join(projectPath, "pyproject.toml"), "description"),
    fromTomlField(path.join(projectPath, "Cargo.toml"), "description"),
    fromReadme(projectPath),
  ];
  for (const c of candidates) {
    if (c && !isBoilerplate(c)) return c;
  }
  return null;
}

function safeRead(filePath: string): string | null {
  try {
    const lstat = fs.lstatSync(filePath);
    if (lstat.isSymbolicLink() || !lstat.isFile()) return null;
    if (lstat.size > MAX_BYTES) return null;
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function fromJsonField(filePath: string, field: string): string | null {
  const raw = safeRead(filePath);
  if (!raw) return null;
  try {
    const data = safeParse<Record<string, unknown>>(raw);
    const value = data[field];
    if (typeof value === "string" && value.trim()) {
      return clip(value.trim());
    }
  } catch {
    // ignore malformed manifest
  }
  return null;
}

// Minimal TOML field lookup — no full parser. Matches `key = "value"` or
// `key = 'value'` at start of line (ignoring whitespace). Good enough for
// the one-line `description = "..."` we care about in pyproject/Cargo.
function fromTomlField(filePath: string, field: string): string | null {
  const raw = safeRead(filePath);
  if (!raw) return null;
  const esc = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*${esc}\\s*=\\s*["']([^"']+)["']`, "m");
  const m = raw.match(re);
  if (m && m[1].trim()) return clip(m[1].trim());
  return null;
}

// Pull the first paragraph of README prose. Skip front-matter fences,
// headings, HTML comments, badges, and blank lines until we find a real
// sentence. Checks common README filenames (case-sensitive on linux, so
// try capitalized and lowercase variants).
function fromReadme(projectPath: string): string | null {
  for (const name of ["README.md", "Readme.md", "readme.md", "README", "README.MD"]) {
    const raw = safeRead(path.join(projectPath, name));
    if (!raw) continue;
    const extracted = firstProse(raw);
    if (extracted) return clip(extracted);
  }
  return null;
}

function firstProse(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  let inFrontMatter = false;
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // YAML front matter on first line.
    if (i === 0 && trimmed === "---") { inFrontMatter = true; continue; }
    if (inFrontMatter) {
      if (trimmed === "---") inFrontMatter = false;
      continue;
    }

    if (trimmed.startsWith("```")) { inCodeFence = !inCodeFence; continue; }
    if (inCodeFence) continue;

    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue; // heading
    if (trimmed.startsWith("<!--")) continue; // html comment
    if (trimmed.startsWith("![")) continue; // image/badge
    if (trimmed.startsWith("[!")) continue; // link-style badge
    // Bullet lines are usually TOCs or feature lists — skip.
    if (/^([*+-]|\d+\.)\s/.test(trimmed)) continue;

    // Strip inline markdown noise so the tagline reads cleanly.
    const cleaned = trimmed
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) -> text
      .replace(/`([^`]+)`/g, "$1") // `code` -> code
      .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold** -> bold
      .replace(/\*([^*]+)\*/g, "$1") // *em* -> em
      .replace(/_([^_]+)_/g, "$1"); // _em_ -> em

    if (cleaned) return cleaned;
  }
  return null;
}

function clip(s: string): string {
  if (s.length <= MAX_LEN) return s;
  // Cut at the last word boundary before the limit, then ellipsize.
  const cut = s.slice(0, MAX_LEN);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > MAX_LEN - 30 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}
