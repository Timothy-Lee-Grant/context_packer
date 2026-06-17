import { buildTree } from "./tree.js";
import type { ReadFile } from "./types.js";

export interface FormatInput {
  files: ReadFile[];
  /** ISO-ish date string for the header (e.g. "2026-06-16"). */
  generatedOn: string;
}

/**
 * Choose a fence length that is safely longer than any run of backticks in
 * the content, so file contents can never prematurely close the code block.
 * Markdown requires the opening/closing fence to be at least as long as any
 * backtick run it contains; we go one longer, minimum three.
 */
function fenceFor(contents: string): string {
  let longestRun = 0;
  let current = 0;
  for (const ch of contents) {
    if (ch === "`") {
      current += 1;
      if (current > longestRun) longestRun = current;
    } else {
      current = 0;
    }
  }
  const length = Math.max(3, longestRun + 1);
  return "`".repeat(length);
}

/** Render a single file as a titled, fenced Markdown block. */
function formatFile(file: ReadFile): string {
  const fence = fenceFor(file.contents);
  // Ensure exactly one trailing newline inside the block for clean rendering.
  const body = file.contents.endsWith("\n")
    ? file.contents
    : `${file.contents}\n`;
  return [
    `### File: \`${file.relativePath}\``,
    `${fence}${file.language}`,
    body.replace(/\n$/, ""),
    fence,
  ].join("\n");
}

/**
 * Assemble the full Markdown bundle: header, project structure tree, then each
 * file's contents. Mirrors the format documented in the README.
 */
export function formatBundle(input: FormatInput): string {
  const { files, generatedOn } = input;
  const paths = files.map((f) => f.relativePath);
  const tree = buildTree(paths);

  const sections: string[] = [
    "# Codebase Context Bundle",
    `Generated on: ${generatedOn}`,
    "",
    "## Project Structure",
    "```text",
    tree,
    "```",
    "",
    "## File Contents",
  ];

  if (files.length === 0) {
    sections.push("", "_No files matched the current filters._");
    return sections.join("\n") + "\n";
  }

  for (const file of files) {
    sections.push("", formatFile(file));
  }

  return sections.join("\n") + "\n";
}
