import fs from "fs";
import path from "path";
import { PATHS } from "./config";
import { resolveProjects } from "./project-resolver";
import type { PlanEntry } from "@/types/project";

export function getPlans(): PlanEntry[] {
  const plansDir = PATHS.plans;
  if (!fs.existsSync(plansDir)) return [];

  const files = fs.readdirSync(plansDir).filter((f) => f.endsWith(".md"));
  const projects = resolveProjects();
  const plans: PlanEntry[] = [];

  for (const file of files) {
    const filePath = path.join(plansDir, file);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const title = extractTitle(content) || file.replace(".md", "");
      const projectSlug = matchToProject(content, title, projects);

      plans.push({ filename: file, title, content, projectSlug: projectSlug || undefined });
    } catch {
      // skip
    }
  }

  return plans;
}

function extractTitle(content: string): string | null {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) return trimmed.slice(2).trim();
    // Skip frontmatter
    if (trimmed === "---") continue;
    if (trimmed.startsWith("name:")) {
      return trimmed.slice(5).trim();
    }
  }
  return null;
}

function matchToProject(
  content: string,
  title: string,
  projects: ReturnType<typeof resolveProjects>
): string | null {
  const lowerContent = (title + " " + content.slice(0, 500)).toLowerCase();

  for (const project of projects) {
    const name = project.name.toLowerCase();
    // Check for project name in content
    if (lowerContent.includes(name)) return project.slug;
    // Check for words from the project name
    const words = name.split(/[-_\s]+/).filter((w) => w.length > 3);
    if (words.length > 0 && words.every((w) => lowerContent.includes(w))) return project.slug;
  }

  return null;
}

export function getPlansForProject(slug: string): PlanEntry[] {
  return getPlans().filter((p) => p.projectSlug === slug);
}
