// Token pricing per model, USD per 1M tokens.
// Cache read = read from an existing cache hit (cheap), cache write = first
// write that populates cache (expensive). Keep these in sync with
// https://www.anthropic.com/pricing when rates change.
interface Rate {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const RATES: Record<string, Rate> = {
  "claude-opus-4": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-opus-4-6": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-sonnet-4": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4": { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
  "claude-haiku-4-5": { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
};

// Fallback rate when a model string doesn't match any known entry. Use the
// Sonnet tier as a reasonable middle-ground estimate so we don't massively
// over- or under-count cost for unknown model ids (e.g. preview names).
const DEFAULT_RATE: Rate = RATES["claude-sonnet-4-6"];

function rateFor(model: string | null | undefined): Rate {
  if (!model) return DEFAULT_RATE;
  // Normalize: the message.model field often looks like
  // "claude-sonnet-4-6-20260315" — strip trailing date segments.
  const normalized = model.replace(/-\d{8}.*$/, "").replace(/\[.*\]$/, "");
  return RATES[normalized] ?? DEFAULT_RATE;
}

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function costFor(tokens: TokenCounts, model: string | null): number {
  const r = rateFor(model);
  return (
    (tokens.inputTokens * r.input +
      tokens.outputTokens * r.output +
      tokens.cacheReadTokens * r.cacheRead +
      tokens.cacheWriteTokens * r.cacheWrite) /
    1_000_000
  );
}

export function formatCost(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  if (usd < 1) return `$${usd.toFixed(2)}`;
  if (usd < 100) return `$${usd.toFixed(2)}`;
  return `$${Math.round(usd).toLocaleString()}`;
}
