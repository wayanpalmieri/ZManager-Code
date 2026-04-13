import fs from "fs";
import path from "path";
import { safeParse } from "./safe-json";

const STORE_PATH = path.join(process.cwd(), "claudeboard-prompts.json");

export interface StoredPrompt {
  id: string;
  name: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

interface StoreFile {
  prompts: StoredPrompt[];
}

function readStore(): StoreFile {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      const data = safeParse<StoreFile>(raw);
      if (Array.isArray(data.prompts)) return { prompts: data.prompts };
    }
  } catch {
    // fall through to empty
  }
  return { prompts: [] };
}

function writeStore(store: StoreFile): void {
  // Atomic write: same temp+rename pattern used by settings/insights-cache.
  const tmp = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_PATH);
}

export function listPrompts(): StoredPrompt[] {
  return readStore()
    .prompts.slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertPrompt(input: {
  id?: string;
  name: string;
  text: string;
}): StoredPrompt {
  const store = readStore();
  const now = new Date().toISOString();

  if (input.id) {
    const idx = store.prompts.findIndex((p) => p.id === input.id);
    if (idx >= 0) {
      const updated = { ...store.prompts[idx], name: input.name, text: input.text, updatedAt: now };
      store.prompts[idx] = updated;
      writeStore(store);
      return updated;
    }
  }

  const created: StoredPrompt = {
    id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    text: input.text,
    createdAt: now,
    updatedAt: now,
  };
  store.prompts.push(created);
  writeStore(store);
  return created;
}

export function deletePrompt(id: string): boolean {
  const store = readStore();
  const before = store.prompts.length;
  store.prompts = store.prompts.filter((p) => p.id !== id);
  if (store.prompts.length === before) return false;
  writeStore(store);
  return true;
}

export function getPrompt(id: string): StoredPrompt | null {
  return readStore().prompts.find((p) => p.id === id) ?? null;
}
