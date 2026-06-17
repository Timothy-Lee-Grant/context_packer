import { describe, expect, it } from "vitest";
import { buildChoices } from "./interactive.js";

describe("buildChoices", () => {
  it("lists changed files first and pre-checked", () => {
    const choices = buildChoices(
      [
        { name: "src", isDir: true },
        { name: "README.md", isDir: false },
      ],
      ["src/index.ts"],
    );

    expect(choices[0]).toEqual({
      name: "★ src/index.ts (changed)",
      value: "src/index.ts",
      checked: true,
    });
  });

  it("orders directories before files", () => {
    const choices = buildChoices(
      [
        { name: "README.md", isDir: false },
        { name: "src", isDir: true },
        { name: "docs", isDir: true },
      ],
      [],
    );
    const values = choices.map((c) => c.value);
    expect(values).toEqual(["docs", "src", "README.md"]);
  });

  it("does not duplicate a top-level changed file", () => {
    const choices = buildChoices(
      [{ name: "config.ts", isDir: false }],
      ["config.ts"],
    );
    const occurrences = choices.filter((c) => c.value === "config.ts");
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.checked).toBe(true);
  });

  it("appends a trailing slash to directory labels", () => {
    const choices = buildChoices([{ name: "src", isDir: true }], []);
    expect(choices[0]?.name).toBe("src/");
  });
});
