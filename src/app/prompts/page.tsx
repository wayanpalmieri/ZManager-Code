"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Plus, Trash2, Zap, Edit3, Check, X } from "lucide-react";
import { useProjects } from "@/hooks/use-api";

interface Prompt {
  id: string;
  name: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function PromptsPage() {
  const { data: prompts, mutate } = useSWR<Prompt[]>("/api/prompts", fetcher);
  const { data: projects } = useProjects();

  const [editing, setEditing] = useState<Prompt | null>(null);
  const [creating, setCreating] = useState(false);
  const [launchTarget, setLaunchTarget] = useState<Prompt | null>(null);

  async function save(name: string, text: string, id?: string) {
    const res = await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, text }),
    });
    if (res.ok) {
      mutate();
      setEditing(null);
      setCreating(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/prompts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) mutate();
  }

  async function launch(prompt: Prompt, slug: string) {
    await fetch("/api/launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, target: "claude", promptText: prompt.text }),
    });
    setLaunchTarget(null);
  }

  return (
    <div className="p-6 space-y-6 max-w-[900px]">
      <div className="animate-in flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-white/95 tracking-tight">Prompts</h1>
          <p className="text-[13px] text-[#98989d] mt-0.5">Reusable prompts you can launch into any project.</p>
        </div>
        <button
          type="button"
          onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-1.5 px-3.5 py-[7px] rounded-[9px] text-[13px] font-medium text-white bg-[#0a84ff] hover:bg-[#409cff] active:scale-[0.97] transition-all cursor-pointer shadow-sm shadow-[#0a84ff]/20"
        >
          <Plus className="h-3.5 w-3.5" /> New Prompt
        </button>
      </div>

      {creating && (
        <PromptEditor onSave={(name, text) => save(name, text)} onCancel={() => setCreating(false)} />
      )}

      {!prompts && <div className="space-y-1">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 shimmer rounded-[10px]" />)}</div>}

      {prompts && prompts.length === 0 && !creating && (
        <p className="text-[13px] text-[#636366]">No prompts yet. Create one to get started.</p>
      )}

      {prompts && prompts.length > 0 && (
        <div className="space-y-2">
          {prompts.map((p) => (
            editing?.id === p.id ? (
              <PromptEditor
                key={p.id}
                initial={p}
                onSave={(name, text) => save(name, text, p.id)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div key={p.id} className="surface p-4 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-white/90">{p.name}</p>
                    <p className="text-[12px] text-[#98989d] mt-1 whitespace-pre-wrap line-clamp-3">{p.text}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => setLaunchTarget(p)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-[#bf5af2] bg-[#bf5af2]/10 hover:bg-[#bf5af2]/15 cursor-pointer transition-colors">
                      <Zap className="h-3 w-3" /> Launch
                    </button>
                    <button type="button" onClick={() => { setEditing(p); setCreating(false); }} className="p-1.5 rounded-lg text-[#636366] hover:text-white/90 hover:bg-white/[0.06] cursor-pointer transition-colors">
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => remove(p.id)} className="p-1.5 rounded-lg text-[#636366] hover:text-[#ff453a] hover:bg-[#ff453a]/10 cursor-pointer transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {launchTarget && projects && (
        <LaunchPicker
          prompt={launchTarget}
          projects={projects.map((p) => ({ slug: p.slug, name: p.name, group: p.group }))}
          onPick={(slug) => launch(launchTarget, slug)}
          onClose={() => setLaunchTarget(null)}
        />
      )}
    </div>
  );
}

function PromptEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Prompt;
  onSave: (name: string, text: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [text, setText] = useState(initial?.text ?? "");

  return (
    <div className="surface-elevated p-4 space-y-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Prompt name"
        className="w-full bg-white/[0.05] border-[0.5px] border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-white/90 placeholder:text-[#48484a] focus:outline-none focus:border-[#0a84ff]/50"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Prompt text (up to 4000 chars)"
        rows={6}
        className="w-full bg-white/[0.05] border-[0.5px] border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-white/90 placeholder:text-[#48484a] focus:outline-none focus:border-[#0a84ff]/50 resize-none font-mono"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSave(name, text)}
          disabled={!name.trim() || !text.trim()}
          className="flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg text-[13px] font-medium text-white bg-[#0a84ff] hover:bg-[#409cff] active:scale-[0.97] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="h-3.5 w-3.5" /> Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-[13px] font-medium text-white/80 bg-white/[0.06] hover:bg-white/[0.1] active:scale-[0.97] transition-all cursor-pointer"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}

function LaunchPicker({
  prompt,
  projects,
  onPick,
  onClose,
}: {
  prompt: Prompt;
  projects: Array<{ slug: string; name: string; group: string | null }>;
  onPick: (slug: string) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = projects.filter((p) =>
    !filter || (p.name + " " + (p.group ?? "")).toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm animate-in" onClick={onClose}>
      <div className="w-[520px] max-w-[90vw] surface-elevated overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-white/[0.06]">
          <p className="text-[11px] text-[#636366] uppercase tracking-wider">Launch prompt</p>
          <p className="text-[13px] text-white/90 truncate mt-0.5">&ldquo;{prompt.name}&rdquo;</p>
        </div>
        <input
          autoFocus
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter projects..."
          className="w-full bg-transparent border-b border-white/[0.04] px-4 py-3 text-[13px] text-white/90 placeholder:text-[#48484a] focus:outline-none"
        />
        <div className="max-h-[50vh] overflow-auto">
          {filtered.length === 0 && <p className="px-4 py-3 text-[13px] text-[#636366]">No projects match.</p>}
          {filtered.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => onPick(p.slug)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-white/[0.05] cursor-pointer transition-colors border-b border-white/[0.02] last:border-0"
            >
              <span className="text-[13px] text-white/90 flex-1 truncate">{p.name}</span>
              {p.group && <span className="text-[10px] text-[#0a84ff]/70 bg-[#0a84ff]/10 px-1.5 py-0.5 rounded shrink-0">{p.group}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
