/**
 * Lightweight token estimation. Real tokenizers (cl100k_base etc.) require a
 * heavy WASM payload; for a CLI that just needs to warn about context-window
 * fit, the well-known heuristic of ~1 token per 4 characters is plenty.
 *
 * We deliberately label every estimate as approximate so users don't mistake
 * it for an exact count.
 */

/** Average characters per token for typical English/code text. */
export const CHARS_PER_TOKEN = 4;

/** Estimate the number of tokens in a string. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Format a large integer with thousands separators (locale-independent). */
export function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Produce a compact human-readable token figure, e.g. 1,234 → "1.2k",
 * 45,000 → "45k". Used in the summary line for quick scanning.
 */
export function humanTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  if (tokens < 1_000_000) {
    const k = tokens / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  const m = tokens / 1_000_000;
  return `${m.toFixed(1)}M`;
}
