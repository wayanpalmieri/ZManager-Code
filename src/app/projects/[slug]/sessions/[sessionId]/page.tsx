"use client";

import { use } from "react";
import { useSessionMessages } from "@/hooks/use-api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, User, Bot, Wrench } from "lucide-react";
import Link from "next/link";
import type { MessageContent } from "@/types/project";

export default function SessionViewerPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = use(params);
  const { data: messages, isLoading } = useSessionMessages(slug, sessionId);
  const title = messages?.find((m) => m.type === "ai-title")?.aiTitle;

  return (
    <div className="p-6 h-full flex flex-col max-w-[800px]">
      <div className="mb-5 animate-in">
        <Link href={`/projects/${slug}`} className="text-[13px] text-[#0a84ff] hover:text-[#409cff] flex items-center gap-1 mb-3 transition-colors cursor-pointer">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <h1 className="text-[18px] font-semibold text-white/95 tracking-tight">{title || "Session"}</h1>
        <p className="text-[11px] text-[#48484a] font-mono mt-0.5">{sessionId}</p>
      </div>

      {isLoading ? (
        <div className="space-y-3 flex-1">{[...Array(4)].map((_, i) => <div key={i} className="h-16 shimmer" />)}</div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-3 pb-6">
            {messages?.filter((m) => m.type === "user" || m.type === "assistant").map((msg, idx) => (
              <div key={idx} className="animate-in" style={{ animationDelay: `${Math.min(idx * 15, 300)}ms` }}>
                <MessageBubble message={msg} />
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: { type: string; message?: { role?: string; content?: MessageContent[]; model?: string } } }) {
  const isUser = message.type === "user";
  const rawContent = message.message?.content;
  const content = Array.isArray(rawContent) ? rawContent : rawContent ? [{ type: "text" as const, text: String(rawContent) }] : [];

  return (
    <div className="flex gap-2.5">
      <div className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center mt-0.5 ${isUser ? "bg-[#0a84ff]/15" : "bg-[#bf5af2]/15"}`}>
        {isUser ? <User className="h-3 w-3 text-[#0a84ff]" /> : <Bot className="h-3 w-3 text-[#bf5af2]" />}
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-[11px] font-medium ${isUser ? "text-[#0a84ff]/70" : "text-[#bf5af2]/70"}`}>{isUser ? "You" : "Claude"}</span>
        {message.message?.model && <span className="text-[10px] text-[#48484a] ml-1.5">{message.message.model}</span>}
        <div className="mt-1 text-[13px] text-white/70 leading-[1.6] space-y-2">
          {content.map((block, i) => {
            if (block.type === "text" && "text" in block) {
              return <div key={i} className="whitespace-pre-wrap break-words">{block.text.slice(0, 2000)}{block.text.length > 2000 && <span className="text-[#48484a] text-[11px]"> ...truncated</span>}</div>;
            }
            if (block.type === "thinking" && "thinking" in block) {
              return (
                <details key={i} className="text-[12px] text-[#636366]">
                  <summary className="cursor-pointer hover:text-[#98989d] transition-colors">Thinking...</summary>
                  <div className="mt-1.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] whitespace-pre-wrap max-h-32 overflow-auto text-[11px] text-[#636366] font-mono">{block.thinking.slice(0, 800)}</div>
                </details>
              );
            }
            if (block.type === "tool_use" && "name" in block) {
              return <div key={i} className="flex items-center gap-1.5 text-[11px] text-[#ff9f0a]/60 py-1.5 px-2.5 rounded-lg bg-[#ff9f0a]/[0.06] border border-[#ff9f0a]/10 font-mono w-fit"><Wrench className="h-3 w-3" /> {block.name}</div>;
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}
