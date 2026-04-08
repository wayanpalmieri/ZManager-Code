import fs from "fs";
import path from "path";
import { resolveProjects } from "./project-resolver";
import { getSessionsForProject } from "./session-parser";
import type { SessionEntry } from "@/types/project";

export interface Insight {
  type: "warning" | "suggestion" | "opportunity" | "health";
  priority: "high" | "medium" | "low";
  project: string;
  projectSlug: string;
  title: string;
  description: string;
  metric?: string;
}

export async function analyzeProjects(): Promise<Insight[]> {
  const projects = resolveProjects();
  const insights: Insight[] = [];
  const now = Date.now();

  for (const project of projects) {
    const sessions = project.claudeDataPath
      ? await getSessionsForProject(project.claudeDataPath)
      : [];

    if (sessions.length === 0) continue;

    const lastSession = sessions[0];
    const lastActivityMs = lastSession ? new Date(lastSession.modified).getTime() : 0;
    const daysSinceActivity = Math.floor((now - lastActivityMs) / (1000 * 60 * 60 * 24));
    const totalMessages = sessions.reduce((s, sess) => s + sess.messageCount, 0);

    // Check for stale projects with significant work
    if (daysSinceActivity > 14 && totalMessages > 100) {
      insights.push({
        type: "warning",
        priority: "medium",
        project: project.name,
        projectSlug: project.slug,
        title: "Inactive project with significant history",
        description: `${totalMessages.toLocaleString()} messages across ${sessions.length} sessions, but no activity in ${daysSinceActivity} days. Consider resuming or archiving.`,
        metric: `${daysSinceActivity}d inactive`,
      });
    }

    // Check for projects with lots of short sessions (context switching)
    const shortSessions = sessions.filter(s => s.messageCount < 10);
    if (shortSessions.length > 3 && shortSessions.length > sessions.length * 0.5) {
      insights.push({
        type: "suggestion",
        priority: "low",
        project: project.name,
        projectSlug: project.slug,
        title: "Many short sessions detected",
        description: `${shortSessions.length} of ${sessions.length} sessions have fewer than 10 messages. Consider consolidating work into longer, focused sessions.`,
        metric: `${shortSessions.length}/${sessions.length} short`,
      });
    }

    // Check for high-activity projects (momentum)
    if (daysSinceActivity <= 3 && totalMessages > 200) {
      insights.push({
        type: "health",
        priority: "low",
        project: project.name,
        projectSlug: project.slug,
        title: "Active and healthy",
        description: `Strong momentum with ${totalMessages.toLocaleString()} messages and recent activity. Keep it going.`,
        metric: `${totalMessages.toLocaleString()} msgs`,
      });
    }

    // Check for very large sessions (might need refactoring)
    const largeSessions = sessions.filter(s => s.messageCount > 500);
    if (largeSessions.length > 0) {
      insights.push({
        type: "suggestion",
        priority: "medium",
        project: project.name,
        projectSlug: project.slug,
        title: "Very large sessions detected",
        description: `${largeSessions.length} session(s) with 500+ messages. Large sessions can lose context. Consider starting fresh sessions for new features.`,
        metric: `${largeSessions.length} large`,
      });
    }

    // Check project filesystem for common missing files
    const projectPath = project.path;
    const missingFiles: string[] = [];
    if (!fs.existsSync(path.join(projectPath, "README.md")) && !fs.existsSync(path.join(projectPath, "readme.md"))) {
      missingFiles.push("README.md");
    }
    if (!fs.existsSync(path.join(projectPath, ".gitignore"))) {
      missingFiles.push(".gitignore");
    }

    // Only flag if the project has a package.json (it's a real code project)
    const hasPackageJson = fs.existsSync(path.join(projectPath, "package.json"));
    if (hasPackageJson && missingFiles.length > 0) {
      insights.push({
        type: "opportunity",
        priority: "low",
        project: project.name,
        projectSlug: project.slug,
        title: `Missing ${missingFiles.join(", ")}`,
        description: `This project is missing common files. Adding these improves maintainability and onboarding.`,
        metric: `${missingFiles.length} file(s)`,
      });
    }

    // Check for projects with only 1 session and high message count (never revisited)
    if (sessions.length === 1 && totalMessages > 50 && daysSinceActivity > 7) {
      insights.push({
        type: "opportunity",
        priority: "medium",
        project: project.name,
        projectSlug: project.slug,
        title: "Single-session project",
        description: `Built in one session (${totalMessages} messages) and never revisited. Might benefit from a review pass or iteration.`,
        metric: "1 session",
      });
    }

    // Recent unfinished work — last session title suggests WIP
    if (lastSession && daysSinceActivity <= 7) {
      const title = (lastSession.title || lastSession.firstPrompt || "").toLowerCase();
      const wipKeywords = ["fix", "bug", "error", "broken", "issue", "debug", "crash", "fail"];
      if (wipKeywords.some(kw => title.includes(kw))) {
        insights.push({
          type: "warning",
          priority: "high",
          project: project.name,
          projectSlug: project.slug,
          title: "Possible unresolved issue",
          description: `Last session "${lastSession.title || lastSession.firstPrompt?.slice(0, 60)}" suggests debugging work. Verify the issue was resolved.`,
          metric: `${daysSinceActivity}d ago`,
        });
      }
    }
  }

  // Sort: high priority first, then by type
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const typeOrder = { warning: 0, opportunity: 1, suggestion: 2, health: 3 };
  insights.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return typeOrder[a.type] - typeOrder[b.type];
  });

  return insights;
}
