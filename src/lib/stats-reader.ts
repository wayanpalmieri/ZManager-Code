import fs from "fs";
import { PATHS } from "./config";
import type { StatsCache, DailyActivity } from "@/types/project";

export function getStats(): StatsCache | null {
  try {
    const raw = fs.readFileSync(PATHS.statsCache, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getDailyActivity(days: number = 30): DailyActivity[] {
  const stats = getStats();
  if (!stats?.dailyActivity) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return stats.dailyActivity
    .filter((d) => new Date(d.date) >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getTotalStats(): { totalMessages: number; totalSessions: number; totalToolCalls: number } {
  const stats = getStats();
  if (!stats?.dailyActivity) return { totalMessages: 0, totalSessions: 0, totalToolCalls: 0 };

  return stats.dailyActivity.reduce(
    (acc, d) => ({
      totalMessages: acc.totalMessages + d.messageCount,
      totalSessions: acc.totalSessions + d.sessionCount,
      totalToolCalls: acc.totalToolCalls + d.toolCallCount,
    }),
    { totalMessages: 0, totalSessions: 0, totalToolCalls: 0 }
  );
}
