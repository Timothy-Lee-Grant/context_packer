import { describe, expect, it } from "vitest";
import { parsePorcelain } from "./git.js";

describe("parsePorcelain", () => {
  it("parses modified and untracked files", () => {
    const out = [" M src/index.ts", "?? new/file.ts", "A  added.ts"].join("\n");
    expect(parsePorcelain(out)).toEqual([
      "src/index.ts",
      "new/file.ts",
      "added.ts",
    ]);
  });

  it("keeps the new path for renames", () => {
    const out = "R  old/name.ts -> new/name.ts";
    expect(parsePorcelain(out)).toEqual(["new/name.ts"]);
  });

  it("unquotes paths with special characters", () => {
    const out = '?? "with space.ts"';
    expect(parsePorcelain(out)).toEqual(["with space.ts"]);
  });

  it("ignores blank lines", () => {
    expect(parsePorcelain("\n\n")).toEqual([]);
  });
});
