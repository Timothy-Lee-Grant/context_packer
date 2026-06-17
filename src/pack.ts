import { buildIgnore } from "./ignore.js";
import { walk } from "./walker.js";
import { filterFiles } from "./filter.js";
import { readFiles } from "./reader.js";
import { formatBundle } from "./formatter.js";
import { estimateTokens } from "./tokens.js";
import type { Options, SkippedFile } from "./types.js";

export interface PackResult {
  /** The assembled Markdown bundle. */
  bundle: string;
  /** Number of files included in the bundle. */
  fileCount: number;
  /** Estimated token count for the whole bundle. */
  tokenEstimate: number;
  /** Everything that was discovered but excluded, with reasons. */
  skipped: SkippedFile[];
}

/** Format today's date as YYYY-MM-DD for the bundle header. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Run the full pipeline — walk → filter → read → format → estimate — and
 * return the bundle plus stats. Side-effect free (no I/O sinks, no logging),
 * which keeps it straightforward to unit-test end to end.
 *
 * An optional `onProgress` hook lets a caller drive a spinner without coupling
 * the pipeline to any particular UI.
 */
export async function pack(
  options: Options,
  onProgress?: (stage: string) => void,
): Promise<PackResult> {
  onProgress?.("Scanning files");
  const ig = await buildIgnore(options.root, options.exclude);
  const walked = await walk(options.root, ig);

  onProgress?.("Filtering");
  const { kept, skipped: filteredOut } = await filterFiles(walked, options);

  onProgress?.("Reading files");
  const { files, skipped: unreadable } = await readFiles(kept);

  onProgress?.("Formatting bundle");
  const bundle = formatBundle({ files, generatedOn: today() });
  const tokenEstimate = estimateTokens(bundle);

  return {
    bundle,
    fileCount: files.length,
    tokenEstimate,
    skipped: [...filteredOut, ...unreadable],
  };
}
