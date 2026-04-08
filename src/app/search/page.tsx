"use client";

import { useState } from "react";
import { useSearch, type SearchResult } from "@/hooks/use-api";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, Clock, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const { data: results, isLoading } = useSearch(query);

  const grouped: Record<string, SearchResult[]> = {};
  if (results) {
    for (const r of results) {
      if (!grouped[r.projectName]) grouped[r.projectName] = [];
      grouped[r.projectName].push(r);
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-[800px]">
      <div className="animate-in">
        <h1 className="text-[22px] font-semibold text-white/95 tracking-tight">Search</h1>
      </div>

      <div className="relative animate-in" style={{ animationDelay: "50ms" }}>
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#48484a]" />
        <Input
          placeholder="Search sessions, prompts, projects..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 h-[36px] bg-white/[0.05] border-white/[0.06] text-[14px] text-white/80 placeholder:text-[#48484a] focus:border-[#0a84ff]/50 focus:ring-1 focus:ring-[#0a84ff]/20 rounded-xl"
          autoFocus
        />
      </div>

      {isLoading && query.length >= 2 && <p className="text-[13px] text-[#636366]">Searching...</p>}
      {results && results.length === 0 && query.length >= 2 && <p className="text-[13px] text-[#636366]">No results for &quot;{query}&quot;</p>}

      {Object.entries(grouped).map(([projectName, items], gi) => (
        <div key={projectName} className="animate-in" style={{ animationDelay: `${100 + gi * 40}ms` }}>
          <p className="section-header">{projectName} <span className="text-[#48484a] normal-case">({items.length})</span></p>
          <div className="overflow-hidden rounded-[10px]">
            {items.map((result) => (
              <Link key={result.sessionId} href={`/projects/${result.projectSlug}/sessions/${result.sessionId}`}>
                <div className="list-row flex items-center justify-between cursor-pointer group">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white/90 truncate">{result.title || result.firstPrompt}</p>
                    {result.title && <p className="text-[12px] text-[#636366] truncate mt-0.5">{result.firstPrompt}</p>}
                    <span className="text-[11px] text-[#48484a] flex items-center gap-1 mt-1"><Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(result.modified), { addSuffix: true })}</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-[#38383a] group-hover:text-[#636366] transition-colors shrink-0 ml-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
