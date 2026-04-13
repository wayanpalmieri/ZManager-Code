// GitHub logo icon. Lucide removed brand glyphs from core, so we ship a
// minimal inline SVG rather than pull in a second icon package.
export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 .5C5.73.5.5 5.74.5 12.03c0 5.08 3.29 9.38 7.86 10.9.57.11.78-.25.78-.55 0-.27-.01-.99-.02-1.95-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.76 2.68 1.25 3.34.96.1-.74.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.18-3.1-.12-.3-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.9-.39 2.88-.39.98 0 1.96.13 2.88.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.75.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.41.35.77 1.05.77 2.11 0 1.52-.01 2.75-.01 3.12 0 .3.21.66.79.55 4.57-1.52 7.86-5.82 7.86-10.9C23.5 5.74 18.27.5 12 .5Z" />
    </svg>
  );
}

import type { Visibility } from "@/hooks/use-api";

// Compact wrapper that renders the GitHub logo plus a small visibility dot
// in the top-right corner. Green = public, amber = private/inaccessible,
// gray = unknown (not yet checked or GitHub API error).
export function GithubLink({
  href,
  visibility,
  size = "sm",
}: {
  href: string;
  visibility?: Visibility;
  size?: "sm" | "md";
}) {
  const iconSize = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const dot =
    visibility === "public"
      ? { color: "#30d158", label: "Public repo" }
      : visibility === "private"
      ? { color: "#ff9f0a", label: "Private or inaccessible" }
      : undefined;

  const labelSuffix = dot ? ` — ${dot.label}` : "";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Open on GitHub${labelSuffix}`}
      className="relative shrink-0 inline-flex items-center justify-center text-[#8e8e93] hover:text-white/90 transition-colors"
    >
      <GithubIcon className={iconSize} />
      {dot && (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 h-[6px] w-[6px] rounded-full ring-[1.5px] ring-[#1c1c1e]"
          style={{ background: dot.color }}
        />
      )}
    </a>
  );
}
