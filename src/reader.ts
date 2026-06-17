import { readFile } from "node:fs/promises";
import pLimit from "p-limit";
import { languageFor } from "./languages.js";
import type { FileEntry, ReadFile, SkippedFile } from "./types.js";

/** Cap concurrent file reads to stay within the file-handle budget. */
const CONCURRENCY = 16;

export interface ReadResult {
  files: ReadFile[];
  /** Files that passed filtering but failed to read as UTF-8 text. */
  skipped: SkippedFile[];
}

/**
 * Read the kept files as UTF-8 text, concurrently but bounded. Any file that
 * cannot be read is reported as "unreadable" rather than aborting the run.
 * Output order matches the (already sorted) input for determinism.
 */
export async function readFiles(entries: FileEntry[]): Promise<ReadResult> {
  const limit = pLimit(CONCURRENCY);
  const results: (ReadFile | null)[] = new Array(entries.length).fill(null);
  const skipped: SkippedFile[] = [];

  await Promise.all(
    entries.map((entry, index) =>
      limit(async () => {
        try {
          const contents = await readFile(entry.absolutePath, "utf8");
          results[index] = {
            relativePath: entry.relativePath,
            contents,
            language: languageFor(entry.relativePath),
            size: entry.size,
          };
        } catch {
          skipped.push({
            relativePath: entry.relativePath,
            reason: "unreadable",
          });
        }
      }),
    ),
  );

  // Drop the holes left by skipped reads while preserving order.
  const files = results.filter((f): f is ReadFile => f !== null);
  return { files, skipped };
}
