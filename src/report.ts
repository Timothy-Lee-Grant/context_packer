import pc from "picocolors";
import { humanTokens, formatNumber } from "./tokens.js";
import type { DeliveryResult } from "./output.js";
import type { SkippedFile } from "./types.js";

export interface ReportInput {
  fileCount: number;
  charCount: number;
  tokenEstimate: number;
  tokenWarnThreshold: number;
  skipped: SkippedFile[];
  delivery: DeliveryResult;
}

/** Build the multi-line summary printed to stderr after a run. */
export function buildReport(input: ReportInput): string {
  const lines: string[] = [];

  // Headline stats.
  const stats =
    `${pc.bold(String(input.fileCount))} files · ` +
    `${formatNumber(input.charCount)} chars · ` +
    `~${humanTokens(input.tokenEstimate)} tokens`;
  lines.push(pc.green("✓ ") + stats);

  // Token warning.
  if (input.tokenEstimate > input.tokenWarnThreshold) {
    lines.push(
      pc.yellow(
        `⚠ Estimated ~${humanTokens(input.tokenEstimate)} tokens exceeds ` +
          `the ${humanTokens(input.tokenWarnThreshold)} threshold — ` +
          `consider narrowing with --dir or --ext.`,
      ),
    );
  }

  // Skip summary, grouped by reason.
  if (input.skipped.length > 0) {
    const byReason = input.skipped.reduce<Record<string, number>>((acc, s) => {
      acc[s.reason] = (acc[s.reason] ?? 0) + 1;
      return acc;
    }, {});
    const parts = Object.entries(byReason)
      .map(([reason, count]) => `${count} ${reason}`)
      .join(", ");
    lines.push(pc.dim(`  skipped ${input.skipped.length} (${parts})`));
  }

  // Delivery destinations.
  const dests: string[] = [];
  if (input.delivery.toClipboard) dests.push("clipboard");
  if (input.delivery.toFile) dests.push(input.delivery.toFile);
  if (input.delivery.toStdout) dests.push("stdout");
  if (dests.length > 0) {
    lines.push(pc.dim(`  → ${dests.join(", ")}`));
  }

  for (const warning of input.delivery.warnings) {
    lines.push(pc.yellow(`⚠ ${warning}`));
  }

  return lines.join("\n");
}
