import { readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import pLimit from "p-limit";
import type { Ignore } from "ignore";
import type { FileEntry } from "./types.js";

/** Cap concurrent directory reads to avoid EMFILE on very large trees. */
const CONCURRENCY = 16;

/** Convert an OS path to POSIX separators for deterministic, matcher-friendly output. */
function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/**
 * Recursively walk `root`, returning every file that survives the ignore
 * matcher. Handles circular symlinks by tracking visited real paths, and
 * limits concurrency to stay within the process file-handle budget.
 *
 * The result is sorted for deterministic output.
 */
export async function walk(root: string, ig: Ignore): Promise<FileEntry[]> {
  const limit = pLimit(CONCURRENCY);
  const results: FileEntry[] = [];
  const visited = new Set<string>();

  async function visitDir(absDir: string): Promise<void> {
    // Resolve symlinks to a canonical path so cycles are detectable.
    let realDir: string;
    try {
      realDir = await realpath(absDir);
    } catch {
      return; // Broken link or vanished directory — skip quietly.
    }
    if (visited.has(realDir)) return;
    visited.add(realDir);

    let entries;
    try {
      entries = await readdir(absDir, { withFileTypes: true });
    } catch {
      return; // Permission denied or removed mid-walk — skip.
    }

    const tasks: Promise<void>[] = [];

    for (const entry of entries) {
      const absChild = path.join(absDir, entry.name);
      const relChild = toPosix(path.relative(root, absChild));

      // The `ignore` library matches directories when the path ends with "/".
      let isDir = entry.isDirectory();
      if (entry.isSymbolicLink()) {
        try {
          isDir = (await stat(absChild)).isDirectory();
        } catch {
          continue; // Dangling symlink.
        }
      }

      const matchPath = isDir ? `${relChild}/` : relChild;
      if (ig.ignores(matchPath)) continue;

      if (isDir) {
        tasks.push(limit(() => visitDir(absChild)));
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        tasks.push(
          limit(async () => {
            try {
              const info = await stat(absChild);
              results.push({
                relativePath: relChild,
                absolutePath: absChild,
                size: info.size,
              });
            } catch {
              // Unreadable stat — drop from results.
            }
          }),
        );
      }
    }

    await Promise.all(tasks);
  }

  await visitDir(root);

  results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return results;
}
