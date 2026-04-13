import fs from "fs";
import path from "path";
import readline from "readline";
import { safeParse } from "./safe-json";
import { costFor } from "./pricing";
import type { SessionEntry, SessionMessage } from "@/types/project";

interface Enrichment {
  title: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  model: string | null;
}

function emptyEnrichment(): Enrichment {
  return {
    title: null,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    model: null,
  };
}

interface SessionIndexFile {
  version: number;
  entries: Array<{
    sessionId: string;
    fullPath: string;
    firstPrompt: string;
    messageCount: number;
    created: string;
    modified: string;
    gitBranch: string;
    isSidechain: boolean;
  }>;
}

// UUID-ish session id — used to discover subfolder-only (archived main-jsonl)
// session directories when scanning without a sessions-index.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const metadataCache = new Map<string, { data: SessionEntry[]; mtime: number }>();

export async function getSessionsForProject(claudeDataPath: string): Promise<SessionEntry[]> {
  if (!claudeDataPath || !fs.existsSync(claudeDataPath)) return [];

  // Check cache by directory mtime
  const stat = fs.statSync(claudeDataPath);
  const cached = metadataCache.get(claudeDataPath);
  if (cached && cached.mtime === stat.mtimeMs) return cached.data;

  // Try sessions-index.json first
  const indexPath = path.join(claudeDataPath, "sessions-index.json");
  if (fs.existsSync(indexPath)) {
    try {
      const raw = fs.readFileSync(indexPath, "utf-8");
      const index = safeParse(raw) as SessionIndexFile;
      const entries: SessionEntry[] = index.entries.map((e) => ({
        sessionId: e.sessionId,
        title: null,
        firstPrompt: e.firstPrompt || "",
        messageCount: e.messageCount,
        created: e.created,
        modified: e.modified,
        gitBranch: e.gitBranch || "",
        isSidechain: e.isSidechain || false,
        entrypoint: "",
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        cost: 0,
        model: null,
        archived: false,
      }));

      // Enrich with ai-title + token/cost in a single JSONL pass per session.
      // Resolution order: primary jsonl next to the index -> the absolute
      // fullPath the index recorded -> surviving subagent jsonls in a
      // <sessionId>/subagents/ sibling directory. Anything after the first
      // fallback marks the session as archived so the UI can show it.
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const indexFullPath = index.entries[i].fullPath;
        const primary = path.join(claudeDataPath, `${entry.sessionId}.jsonl`);

        let enrichment: Enrichment | null = null;
        if (fs.existsSync(primary)) {
          enrichment = await extractEnrichment(primary);
        } else if (indexFullPath && fs.existsSync(indexFullPath)) {
          enrichment = await extractEnrichment(indexFullPath);
        } else {
          entry.archived = true;
          const subagentDir = path.join(claudeDataPath, entry.sessionId, "subagents");
          if (fs.existsSync(subagentDir)) {
            enrichment = await extractFromSubagents(subagentDir);
          }
        }

        if (enrichment) {
          entry.title = enrichment.title;
          entry.inputTokens = enrichment.inputTokens;
          entry.outputTokens = enrichment.outputTokens;
          entry.cacheReadTokens = enrichment.cacheReadTokens;
          entry.cacheWriteTokens = enrichment.cacheWriteTokens;
          entry.model = enrichment.model;
          entry.cost = costFor(enrichment, enrichment.model);
        }
      }

      metadataCache.set(claudeDataPath, { data: entries, mtime: stat.mtimeMs });
      return entries;
    } catch {
      // Fall through to JSONL scanning
    }
  }

  // No index — scan JSONL files + recover archived sessions from subfolders.
  const dirents = fs.readdirSync(claudeDataPath, { withFileTypes: true });
  const entries: SessionEntry[] = [];
  const seenIds = new Set<string>();

  for (const dirent of dirents) {
    if (!dirent.isFile() || !dirent.name.endsWith(".jsonl")) continue;
    const jsonlPath = path.join(claudeDataPath, dirent.name);
    const sessionId = path.basename(dirent.name, ".jsonl");
    const meta = await parseSessionMetadata(jsonlPath, sessionId);
    if (meta) {
      entries.push(meta);
      seenIds.add(sessionId);
    }
  }

  // Pick up sessions that have had their main .jsonl archived but still have
  // a surviving <sessionId>/subagents/ folder on disk. This is the same
  // "archived" case the index path handles; here there's no index to give
  // us created/modified/firstPrompt, so we synthesize as best we can.
  for (const dirent of dirents) {
    if (!dirent.isDirectory() || !UUID_RE.test(dirent.name)) continue;
    if (seenIds.has(dirent.name)) continue;
    const subagentDir = path.join(claudeDataPath, dirent.name, "subagents");
    if (!fs.existsSync(subagentDir)) continue;
    const enrichment = await extractFromSubagents(subagentDir);
    const dirStat = fs.statSync(path.join(claudeDataPath, dirent.name));
    const modified = dirStat.mtime.toISOString();
    entries.push({
      sessionId: dirent.name,
      title: enrichment.title,
      firstPrompt: "",
      messageCount: 0,
      created: modified,
      modified,
      gitBranch: "",
      isSidechain: false,
      entrypoint: "",
      inputTokens: enrichment.inputTokens,
      outputTokens: enrichment.outputTokens,
      cacheReadTokens: enrichment.cacheReadTokens,
      cacheWriteTokens: enrichment.cacheWriteTokens,
      cost: costFor(enrichment, enrichment.model),
      model: enrichment.model,
      archived: true,
    });
  }

  entries.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
  metadataCache.set(claudeDataPath, { data: entries, mtime: stat.mtimeMs });
  return entries;
}

// Sum usage across every subagent JSONL in a <sessionId>/subagents/ folder.
// Used to recover partial token/cost data when the primary session JSONL has
// been archived. The returned numbers undercount the real session cost (they
// miss the main-thread tokens) but beat showing a bogus $0.
async function extractFromSubagents(subagentDir: string): Promise<Enrichment> {
  const files = fs
    .readdirSync(subagentDir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join(subagentDir, f));
  const agg = emptyEnrichment();
  for (const f of files) {
    const e = await extractEnrichment(f);
    agg.inputTokens += e.inputTokens;
    agg.outputTokens += e.outputTokens;
    agg.cacheReadTokens += e.cacheReadTokens;
    agg.cacheWriteTokens += e.cacheWriteTokens;
    if (!agg.model && e.model) agg.model = e.model;
    if (!agg.title && e.title) agg.title = e.title;
  }
  return agg;
}

// Walk the JSONL once, collecting both the ai-title and per-assistant-message
// token usage. Called only when we've already loaded structural metadata
// (messageCount, created/modified) from the sessions-index — this pass is
// purely for enrichment fields not in the index.
async function extractEnrichment(jsonlPath: string): Promise<Enrichment> {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(jsonlPath, { encoding: "utf-8" });
    const rl = readline.createInterface({ input: stream });
    const acc = emptyEnrichment();

    rl.on("line", (line) => {
      try {
        const entry = safeParse(line) as SessionMessage;
        if (entry.type === "ai-title" && entry.aiTitle && !acc.title) {
          acc.title = entry.aiTitle;
        }
        if (entry.type === "assistant" && entry.message) {
          if (entry.message.model && !acc.model) acc.model = entry.message.model;
          const u = entry.message.usage;
          if (u) {
            acc.inputTokens += u.input_tokens ?? 0;
            acc.outputTokens += u.output_tokens ?? 0;
            acc.cacheReadTokens += u.cache_read_input_tokens ?? 0;
            acc.cacheWriteTokens += u.cache_creation_input_tokens ?? 0;
          }
        }
      } catch {
        // skip malformed lines
      }
    });

    rl.on("close", () => resolve(acc));
  });
}

async function parseSessionMetadata(jsonlPath: string, sessionId: string): Promise<SessionEntry | null> {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(jsonlPath, { encoding: "utf-8" });
    const rl = readline.createInterface({ input: stream });

    let title: string | null = null;
    let firstPrompt = "";
    let created: string | null = null;
    let modified: string | null = null;
    let gitBranch = "";
    let entrypoint = "";
    let messageCount = 0;
    let isSidechain = false;
    let model: string | null = null;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheWriteTokens = 0;

    rl.on("line", (line) => {
      try {
        const entry = safeParse(line) as SessionMessage;

        if (entry.timestamp) {
          if (!created || entry.timestamp < created) created = entry.timestamp;
          if (!modified || entry.timestamp > modified) modified = entry.timestamp;
        }

        if (entry.type === "ai-title" && entry.aiTitle) {
          title = entry.aiTitle;
        }

        if (entry.type === "user") {
          messageCount++;
          if (!firstPrompt && entry.message?.content) {
            const textBlock = entry.message.content.find((c) => c.type === "text");
            if (textBlock && "text" in textBlock) {
              firstPrompt = textBlock.text.slice(0, 200);
            }
          }
          if (entry.isSidechain) isSidechain = true;
        }

        if (entry.type === "assistant") {
          messageCount++;
          if (entry.message?.model && !model) model = entry.message.model;
          const u = entry.message?.usage;
          if (u) {
            inputTokens += u.input_tokens ?? 0;
            outputTokens += u.output_tokens ?? 0;
            cacheReadTokens += u.cache_read_input_tokens ?? 0;
            cacheWriteTokens += u.cache_creation_input_tokens ?? 0;
          }
        }

        if (entry.gitBranch && !gitBranch) gitBranch = entry.gitBranch;
        if (entry.entrypoint && !entrypoint) entrypoint = entry.entrypoint;
      } catch {
        // skip malformed
      }
    });

    rl.on("close", () => {
      if (!created) {
        resolve(null);
        return;
      }
      const tokens = { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens };
      resolve({
        sessionId,
        title,
        firstPrompt,
        messageCount,
        created: created!,
        modified: modified || created!,
        gitBranch,
        isSidechain,
        entrypoint,
        ...tokens,
        cost: costFor(tokens, model),
        model,
        archived: false,
      });
    });
  });
}

export async function getSessionMessages(jsonlPath: string): Promise<SessionMessage[]> {
  if (!fs.existsSync(jsonlPath)) return [];

  const messages: SessionMessage[] = [];
  const stream = fs.createReadStream(jsonlPath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream });

  return new Promise((resolve) => {
    rl.on("line", (line) => {
      try {
        const entry = safeParse(line) as SessionMessage;
        // Only include displayable message types
        if (["user", "assistant", "ai-title"].includes(entry.type)) {
          messages.push(entry);
        }
      } catch {
        // skip
      }
    });

    rl.on("close", () => resolve(messages));
  });
}
