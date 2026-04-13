"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { FolderOpen, Zap, Search, Bookmark, ArrowRight, Settings, Sparkles, LayoutDashboard } from "lucide-react";
import { useModifierLabel } from "@/hooks/use-platform";
import type { ProjectMeta } from "@/types/project";

interface Prompt {
  id: string;
  name: string;
  text: string;
}

type Item =
  | { type: "project"; slug: string; name: string; group: string | null }
  | { type: "session"; slug: string; projectName: string; sessionId: string; title: string; firstPrompt: string }
  | { type: "prompt"; id: string; name: string; text: string }
  | { type: "action"; action: "resume-claude" | "open-vscode" | "open-terminal"; slug: string; projectName: string }
  | { type: "nav"; label: string; href: string; icon: React.ComponentType<{ className?: string }> };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Lightweight fuzzy-ish match: substring match on lowercased haystack with
// a score that rewards earlier hits and full-word boundaries. Good enough
// for a few hundred items without pulling in a fuzzy library.
function score(needle: string, hay: string): number {
  if (!needle) return 1;
  const n = needle.toLowerCase();
  const h = hay.toLowerCase();
  const idx = h.indexOf(n);
  if (idx === -1) return 0;
  // Earlier match = higher score; word-start bonus.
  const wordStart = idx === 0 || !/[a-z0-9]/.test(h[idx - 1]);
  return 1000 - idx + (wordStart ? 100 : 0);
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const modLabel = useModifierLabel();

  // Only fetch once the palette opens — keeps the home page fast.
  const { data: projects } = useSWR<ProjectMeta[]>(open ? "/api/projects" : null, fetcher);
  const { data: prompts } = useSWR<Prompt[]>(open ? "/api/prompts" : null, fetcher);

  // Keyboard: ⌘K / Ctrl+K to open, Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    out.push({ type: "nav", label: "Dashboard", href: "/", icon: LayoutDashboard });
    out.push({ type: "nav", label: "Projects", href: "/projects", icon: FolderOpen });
    out.push({ type: "nav", label: "Prompts", href: "/prompts", icon: Bookmark });
    out.push({ type: "nav", label: "Insights", href: "/tasks", icon: Sparkles });
    out.push({ type: "nav", label: "Search", href: "/search", icon: Search });
    out.push({ type: "nav", label: "Settings", href: "/settings", icon: Settings });

    for (const p of projects ?? []) {
      out.push({ type: "project", slug: p.slug, name: p.name, group: p.group });
      out.push({ type: "action", action: "resume-claude", slug: p.slug, projectName: p.name });
      out.push({ type: "action", action: "open-vscode", slug: p.slug, projectName: p.name });
      out.push({ type: "action", action: "open-terminal", slug: p.slug, projectName: p.name });
    }
    for (const pr of prompts ?? []) {
      out.push({ type: "prompt", id: pr.id, name: pr.name, text: pr.text });
    }
    return out;
  }, [projects, prompts]);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      // With no query, show navs + first several projects for quick access.
      return items.filter((it) => it.type === "nav" || it.type === "project").slice(0, 20);
    }
    const ranked = items
      .map((it) => ({ it, s: score(query, labelFor(it)) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map((r) => r.it);
    return ranked;
  }, [items, query]);

  useEffect(() => {
    setCursor(0);
  }, [filtered.length]);

  async function run(item: Item) {
    setOpen(false);
    if (item.type === "nav") {
      router.push(item.href);
      return;
    }
    if (item.type === "project") {
      router.push(`/projects/${item.slug}`);
      return;
    }
    if (item.type === "session") {
      router.push(`/projects/${item.slug}/sessions/${item.sessionId}`);
      return;
    }
    if (item.type === "prompt") {
      router.push(`/prompts`);
      return;
    }
    if (item.type === "action") {
      const target = item.action === "resume-claude" ? "claude" : item.action === "open-vscode" ? "vscode" : "terminal";
      await fetch("/api/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: item.slug, target }),
      });
    }
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = filtered[cursor];
      if (picked) run(picked);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] bg-black/40 backdrop-blur-sm animate-in" onClick={() => setOpen(false)}>
      <div className="w-[620px] max-w-[92vw] bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-[12px] border-[0.5px] border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
          <Search className="h-4 w-4 text-[#636366]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Jump to project, action, or prompt…"
            className="flex-1 bg-transparent text-[14px] text-white/95 placeholder:text-[#48484a] focus:outline-none"
          />
          <kbd className="text-[10px] text-[#636366] bg-white/[0.06] px-1.5 py-0.5 rounded font-mono">esc</kbd>
        </div>
        <div className="max-h-[55vh] overflow-auto">
          {filtered.length === 0 && <p className="px-4 py-6 text-[13px] text-[#636366] text-center">No matches.</p>}
          {filtered.map((item, i) => (
            <button
              key={keyFor(item, i)}
              type="button"
              onMouseEnter={() => setCursor(i)}
              onClick={() => run(item)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors ${i === cursor ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}
            >
              <IconFor item={item} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white/90 truncate">{labelFor(item)}</p>
                {sublabelFor(item) && <p className="text-[11px] text-[#636366] truncate mt-0.5">{sublabelFor(item)}</p>}
              </div>
              <span className="text-[10px] text-[#48484a] uppercase tracking-wider shrink-0">{badgeFor(item)}</span>
              {i === cursor && <ArrowRight className="h-3 w-3 text-[#636366] shrink-0" />}
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-3 text-[10px] text-[#636366]">
          <span><kbd className="bg-white/[0.06] px-1 py-0.5 rounded font-mono">↑↓</kbd> nav</span>
          <span><kbd className="bg-white/[0.06] px-1 py-0.5 rounded font-mono">↵</kbd> select</span>
          <span className="ml-auto"><kbd className="bg-white/[0.06] px-1 py-0.5 rounded font-mono">{modLabel}</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}

function labelFor(item: Item): string {
  switch (item.type) {
    case "nav": return `Go to ${item.label}`;
    case "project": return item.name + (item.group ? ` · ${item.group}` : "");
    case "session": return item.title || item.firstPrompt || item.sessionId;
    case "prompt": return `Launch prompt: ${item.name}`;
    case "action":
      return item.action === "resume-claude"
        ? `Launch Claude in ${item.projectName}`
        : item.action === "open-vscode"
        ? `Open ${item.projectName} in VS Code`
        : `Open terminal in ${item.projectName}`;
  }
}

function sublabelFor(item: Item): string | null {
  if (item.type === "session") return item.projectName;
  if (item.type === "prompt") return item.text.slice(0, 80);
  return null;
}

function badgeFor(item: Item): string {
  switch (item.type) {
    case "nav": return "go";
    case "project": return "project";
    case "session": return "session";
    case "prompt": return "prompt";
    case "action": return "launch";
  }
}

function keyFor(item: Item, i: number): string {
  switch (item.type) {
    case "nav": return `nav:${item.href}`;
    case "project": return `proj:${item.slug}`;
    case "session": return `sess:${item.sessionId}`;
    case "prompt": return `prompt:${item.id}`;
    case "action": return `act:${item.action}:${item.slug}`;
    default: return `k:${i}`;
  }
}

function IconFor({ item }: { item: Item }) {
  const cls = "h-3.5 w-3.5 text-[#98989d] shrink-0";
  if (item.type === "nav") {
    const Icon = item.icon;
    return <Icon className={cls} />;
  }
  if (item.type === "project") return <FolderOpen className={cls} />;
  if (item.type === "session") return <Search className={cls} />;
  if (item.type === "prompt") return <Bookmark className={cls} />;
  if (item.type === "action") return <Zap className={`${cls} text-[#bf5af2]`} />;
  return null;
}
