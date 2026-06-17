import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Return the list of changed/untracked files (POSIX-relative paths) reported
 * by `git status --porcelain`, or an empty list if this is not a git repo or
 * git is unavailable. Never throws — interactive mode treats git as optional.
 */
export async function changedFiles(root: string): Promise<string[]> {
  try {
    const { stdout } = await run(
      "git",
      ["status", "--porcelain", "--untracked-files=all"],
      { cwd: root, encoding: "utf8" },
    );
    return parsePorcelain(stdout);
  } catch {
    return [];
  }
}

/**
 * Parse `git status --porcelain` output into clean relative paths. Handles
 * renames ("R  old -> new" keeps the new path) and quoted paths.
 */
export function parsePorcelain(output: string): string[] {
  const files: string[] = [];
  for (const rawLine of output.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.trim().length === 0) continue;

    // Format: XY <path> or XY <old> -> <new>. Drop the 2-char status + space.
    let pathPart = line.slice(3);
    const arrow = pathPart.indexOf(" -> ");
    if (arrow !== -1) {
      pathPart = pathPart.slice(arrow + 4);
    }
    files.push(unquote(pathPart.trim()));
  }
  return files;
}

/** Git quotes paths with special chars in double quotes; strip them. */
function unquote(p: string): string {
  if (p.startsWith('"') && p.endsWith('"')) {
    return p.slice(1, -1);
  }
  return p;
}
