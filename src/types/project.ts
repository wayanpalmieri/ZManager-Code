export interface ProjectMeta {
  slug: string;
  name: string;
  group: string | null;
  description: string;
  path: string;
  claudeDataPath: string;
  sessionCount: number;
  totalMessages: number;
  lastActivity: string | null;
  gitBranch: string;
  isActive: boolean;
}

export interface ProjectDetail extends ProjectMeta {
  sessions: SessionEntry[];
  todos: TodoItem[];
  plans: PlanEntry[];
}

export interface SessionEntry {
  sessionId: string;
  title: string | null;
  firstPrompt: string;
  messageCount: number;
  created: string;
  modified: string;
  gitBranch: string;
  isSidechain: boolean;
  entrypoint: string;
}

export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm: string;
  sessionId?: string;
  projectSlug?: string;
}

export interface PlanEntry {
  filename: string;
  title: string;
  content: string;
  projectSlug?: string;
}

export interface SessionMessage {
  type: "user" | "assistant" | "system" | "progress" | "ai-title" | "queue-operation" | "file-history-snapshot" | "last-prompt" | "attachment";
  uuid?: string;
  parentUuid?: string;
  timestamp?: string;
  sessionId?: string;
  message?: {
    role?: string;
    model?: string;
    content?: MessageContent[];
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
  aiTitle?: string;
  isSidechain?: boolean;
  data?: Record<string, unknown>;
  cwd?: string;
  gitBranch?: string;
  entrypoint?: string;
  version?: string;
}

export type MessageContent =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature?: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string | MessageContent[] };

export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface StatsCache {
  version: number;
  lastComputedDate: string;
  dailyActivity: DailyActivity[];
}

export interface ActiveSession {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind: string;
  entrypoint: string;
  projectSlug?: string;
  isAlive: boolean;
}
