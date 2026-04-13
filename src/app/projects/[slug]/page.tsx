"use client";

import { use, useState } from "react";
import { useProject, launchProject, useGitStatuses, useGitHubVisibility } from "@/hooks/use-api";
import { LaunchButtons } from "@/components/launch-buttons";
import { ArrowLeft, MessageSquare, Clock, GitBranch, ChevronRight, Zap, DollarSign } from "lucide-react";
import { GithubLink } from "@/components/icons/github";
import { formatDistanceToNow, format } from "date-fns";
import { formatCost } from "@/lib/pricing";
import Link from "next/link";

export default function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: project, isLoading } = useProject(slug);
  const { data: gitStatuses } = useGitStatuses();
  const { data: visibility } = useGitHubVisibility();
  const git = gitStatuses?.[slug];
  const vis = visibility?.[slug];
  const [resuming, setResuming] = useState<string | null>(null);

  async function handleResume(sessionId: string) {
    setResuming(sessionId);
    await launchProject(slug, "claude", { sessionId });
    setTimeout(() => setResuming(null), 1500);
  }

  if (isLoading) {
    return <div className="p-6 space-y-4"><div className="h-7 w-48 shimmer" /><div className="h-4 w-80 shimmer" /><div className="grid grid-cols-3 gap-3 mt-4">{[...Array(3)].map((_, i) => <div key={i} className="h-20 shimmer" />)}</div></div>;
  }

  if (!project) {
    return (
      <div className="p-6">
        <Link href="/projects" className="text-[13px] text-[#0a84ff] flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Projects</Link>
        <p className="mt-4 text-[#636366]">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      <div className="animate-in">
        <Link href="/projects" className="text-[13px] text-[#0a84ff] hover:text-[#409cff] flex items-center gap-1 mb-3 transition-colors cursor-pointer">
          <ArrowLeft className="h-3.5 w-3.5" /> Projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[22px] font-semibold text-white/95 tracking-tight">{project.name}</h1>
              {project.isActive && (
                <span className="text-[11px] font-medium text-[#30d158] bg-[#30d158]/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#30d158] live-dot" /> Live
                </span>
              )}
            </div>
            {project.description && <p className="text-[13px] text-[#98989d] mt-1">{project.description}</p>}
            <div className="flex items-center gap-3 mt-1">
              <p className="text-[11px] text-[#48484a] font-mono">{project.path}</p>
              {git?.remoteUrl && (
                <div className="flex items-center gap-1.5 text-[11px] text-[#8e8e93]">
                  <GithubLink href={git.remoteUrl} visibility={vis} />
                  <span className={vis === "public" ? "text-[#30d158]/80" : vis === "private" ? "text-[#ff9f0a]/80" : ""}>
                    {vis === "public" ? "Public" : vis === "private" ? "Private" : "GitHub"}
                  </span>
                </div>
              )}
            </div>
          </div>
          <LaunchButtons slug={slug} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 animate-in" style={{ animationDelay: "50ms" }}>
        {[
          { label: "Sessions", value: String(project.sessionCount) },
          { label: "Messages", value: project.totalMessages.toLocaleString() },
          { label: "Total Cost", value: formatCost(project.totalCost) },
          { label: "Last Active", value: project.lastActivity ? formatDistanceToNow(new Date(project.lastActivity), { addSuffix: true }) : "Never" },
        ].map((s) => (
          <div key={s.label} className="surface p-4">
            <p className="text-[12px] text-[#98989d] mb-1">{s.label}</p>
            <p className="text-[18px] font-semibold text-white/90 tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Sessions */}
      <div className="animate-in" style={{ animationDelay: "100ms" }}>
        <p className="section-header">Sessions ({project.sessions.length})</p>
        {project.sessions.length === 0 ? (
          <p className="text-[13px] text-[#636366]">No sessions yet.</p>
        ) : (
          <div className="overflow-hidden rounded-[10px]">
            {project.sessions.map((session) => (
              <div key={session.sessionId} className="list-row flex items-center justify-between group">
                <Link href={`/projects/${slug}/sessions/${session.sessionId}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-white/90 truncate">{session.title || session.firstPrompt || "Untitled"}</p>
                    {session.archived && (
                      <span className="text-[10px] text-[#8e8e93] bg-white/[0.04] px-1.5 py-0.5 rounded shrink-0">archived</span>
                    )}
                  </div>
                  {session.title && session.firstPrompt && <p className="text-[12px] text-[#636366] truncate mt-0.5">{session.firstPrompt}</p>}
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-[#48484a] tabular-nums">
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {session.messageCount}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(session.created), "MMM d, yyyy")}</span>
                    {session.gitBranch && session.gitBranch !== "HEAD" && <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> {session.gitBranch}</span>}
                    {session.cost > 0 && (
                      <span className="flex items-center gap-1" title={session.archived ? "Partial: recovered from subagent logs only" : undefined}>
                        <DollarSign className="h-3 w-3" />
                        {formatCost(session.cost)}{session.archived ? "+" : ""}
                      </span>
                    )}
                  </div>
                </Link>
                <div className="flex items-center gap-1.5 shrink-0 ml-3">
                  {!session.archived && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); handleResume(session.sessionId); }}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#bf5af2] bg-[#bf5af2]/10 hover:bg-[#bf5af2]/15 active:scale-[0.96] transition-all cursor-pointer"
                      title="Resume this session in a new Claude terminal"
                    >
                      <Zap className="h-3 w-3" />
                      {resuming === session.sessionId ? "Launching…" : "Resume"}
                    </button>
                  )}
                  {session.entrypoint && <span className="text-[10px] text-[#48484a] bg-white/[0.04] px-1.5 py-0.5 rounded">{session.entrypoint}</span>}
                  <Link href={`/projects/${slug}/sessions/${session.sessionId}`}>
                    <ChevronRight className="h-3.5 w-3.5 text-[#38383a] group-hover:text-[#636366] transition-colors" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Todos */}
      {project.todos.length > 0 && (
        <div className="animate-in" style={{ animationDelay: "150ms" }}>
          <p className="section-header">Tasks ({project.todos.length})</p>
          <div className="overflow-hidden rounded-[10px]">
            {project.todos.map((todo, i) => {
              const c = { completed: "#30d158", in_progress: "#0a84ff", pending: "#636366" }[todo.status];
              return (
                <div key={i} className="list-row flex items-center gap-3">
                  <div className="h-[7px] w-[7px] rounded-full shrink-0" style={{ background: c }} />
                  <span className="text-[13px] text-white/70 flex-1 truncate">{todo.content}</span>
                  <span className="text-[11px] text-[#48484a] capitalize">{todo.status.replace("_", " ")}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
