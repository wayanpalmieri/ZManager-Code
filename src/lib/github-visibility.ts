// Resolve GitHub repo visibility (public vs private/inaccessible) using the
// unauthenticated REST API. Anon requests are rate-limited to 60/hour per IP,
// so we cache results aggressively per canonical repo URL. "Private or
// inaccessible" conflates genuinely private repos with renamed/deleted/
// moved ones — honest copy matters in the UI.

export type Visibility = "public" | "private" | "unknown";

interface CacheEntry {
  visibility: Visibility;
  checkedAt: number;
}

// 6 hours — visibility rarely changes, and the anonymous rate limit is tight.
const TTL_MS = 6 * 60 * 60 * 1000;

const cache = new Map<string, CacheEntry>();

// Extract "owner/repo" from a canonical https://github.com/<owner>/<repo> URL.
function parseRepo(url: string): { owner: string; repo: string } | null {
  const m = url.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

async function fetchVisibility(url: string, signal: AbortSignal): Promise<Visibility> {
  const parsed = parseRepo(url);
  if (!parsed) return "unknown";
  try {
    const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
      signal,
      headers: {
        // Asking for a specific API version keeps us on a stable contract and
        // is the documented best practice for anonymous calls.
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (res.status === 200) return "public";
    // 404 is ambiguous: private OR nonexistent. Caller decides how to phrase.
    if (res.status === 404) return "private";
    // 403 with rate-limit headers means we should back off.
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function getVisibilities(
  urls: string[]
): Promise<Record<string, Visibility>> {
  const now = Date.now();
  const out: Record<string, Visibility> = {};
  const misses: string[] = [];

  for (const url of urls) {
    const hit = cache.get(url);
    if (hit && now - hit.checkedAt < TTL_MS) {
      out[url] = hit.visibility;
    } else {
      misses.push(url);
    }
  }

  if (misses.length > 0) {
    // Bound concurrency so we don't fire 19 simultaneous requests and also
    // so a slow GitHub response can't block every other check. 6 is well
    // under the 60/hour anon rate limit per IP.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      await runWithConcurrency(6, misses, async (url) => {
        const visibility = await fetchVisibility(url, controller.signal);
        cache.set(url, { visibility, checkedAt: now });
        out[url] = visibility;
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return out;
}

async function runWithConcurrency<T>(
  limit: number,
  items: T[],
  worker: (item: T) => Promise<void>
): Promise<void> {
  const queue = items.slice();
  const runners: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, queue.length); i++) {
    runners.push(
      (async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (item === undefined) return;
          await worker(item);
        }
      })()
    );
  }
  await Promise.all(runners);
}
