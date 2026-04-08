"use client";

import { useState, useEffect } from "react";
import { FolderOpen, Check, AlertCircle, HardDrive } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const [folder, setFolder] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setFolder(data.projectsFolder || "");
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    setError(null);
    setSaved(false);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectsFolder: folder }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
    } else {
      setFolder(data.projectsFolder);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-[700px]">
      <div className="animate-in">
        <h1 className="text-[22px] font-semibold text-white/95 tracking-tight">Settings</h1>
        <p className="text-[13px] text-[#98989d] mt-0.5">Configure your ZManager Code preferences</p>
      </div>

      {/* Projects Location */}
      <div className="animate-in" style={{ animationDelay: "50ms" }}>
        <p className="section-header">Projects Location</p>
        <div className="overflow-hidden rounded-[10px]">
          <div className="bg-[rgba(44,44,46,0.72)] backdrop-blur-xl border-[0.5px] border-white/[0.06] p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-[#0a84ff]/15 flex items-center justify-center shrink-0 mt-0.5">
                <HardDrive className="h-4.5 w-4.5 text-[#0a84ff]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-white/90">Root directory</p>
                <p className="text-[12px] text-[#636366] mt-0.5 leading-relaxed">
                  The folder that contains all your Claude Code project folders. ZManager Code will scan this directory and its subfolders for projects.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#48484a]" />
                {loading ? (
                  <div className="h-[34px] shimmer rounded-lg" />
                ) : (
                  <Input
                    value={folder}
                    onChange={(e) => { setFolder(e.target.value); setSaved(false); setError(null); }}
                    placeholder="/path/to/your/projects"
                    className="pl-9 h-[34px] bg-white/[0.05] border-white/[0.06] text-[13px] text-white/80 placeholder:text-[#48484a] font-mono focus:border-[#0a84ff]/50 rounded-lg"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-[7px] rounded-lg text-[13px] font-medium text-white bg-[#0a84ff] hover:bg-[#409cff] active:bg-[#0060c0] active:scale-[0.97] transition-all duration-200 cursor-pointer disabled:opacity-50 shadow-sm shadow-[#0a84ff]/20"
              >
                {saved ? <Check className="h-3.5 w-3.5" /> : <FolderOpen className="h-3.5 w-3.5" />}
                {saved ? "Saved" : "Save"}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 mt-3 text-[12px] text-[#ff453a]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}

            {saved && (
              <p className="text-[12px] text-[#30d158] mt-3 flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" />
                Settings saved. Refresh the Projects page to see changes.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="animate-in" style={{ animationDelay: "100ms" }}>
        <p className="section-header">About</p>
        <div className="overflow-hidden rounded-[10px]">
          <div className="bg-[rgba(44,44,46,0.72)] backdrop-blur-xl border-[0.5px] border-white/[0.06]">
            {[
              { label: "Version", value: "1.0.0" },
              { label: "Claude Data", value: "~/.claude" },
              { label: "Framework", value: "Next.js + React" },
            ].map((item, i, arr) => (
              <div
                key={item.label}
                className={`flex items-center justify-between px-4 py-3 ${i < arr.length - 1 ? "border-b-[0.5px] border-white/[0.04]" : ""}`}
              >
                <span className="text-[13px] text-white/70">{item.label}</span>
                <span className="text-[13px] text-[#98989d] font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
