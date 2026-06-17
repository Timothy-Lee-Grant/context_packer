import { describe, expect, it } from "vitest";
import { formatBundle } from "./formatter.js";
import type { ReadFile } from "./types.js";

function file(
  relativePath: string,
  contents: string,
  language = "",
): ReadFile {
  return { relativePath, contents, language, size: contents.length };
}

describe("formatBundle", () => {
  it("includes header, tree, and tagged file blocks", () => {
    const out = formatBundle({
      generatedOn: "2026-06-16",
      files: [file("src/index.ts", "export const x = 1;", "typescript")],
    });

    expect(out).toContain("# Codebase Context Bundle");
    expect(out).toContain("Generated on: 2026-06-16");
    expect(out).toContain("## Project Structure");
    expect(out).toContain("### File: `src/index.ts`");
    expect(out).toContain("```typescript");
    expect(out).toContain("export const x = 1;");
  });

  it("uses a longer fence when content contains triple backticks", () => {
    const md = "Here is code:\n```js\nconst x = 1;\n```\n";
    const out = formatBundle({
      generatedOn: "2026-06-16",
      files: [file("README.md", md, "markdown")],
    });

    // Opening fence must be at least 4 backticks so the inner ``` is contained.
    expect(out).toContain("````markdown");
    expect(out).toContain("````\n"); // closing fence
  });

  it("handles the empty case gracefully", () => {
    const out = formatBundle({ generatedOn: "2026-06-16", files: [] });
    expect(out).toContain("_No files matched the current filters._");
  });
});
