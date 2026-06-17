import { describe, expect, it } from "vitest";
import { buildTree } from "./tree.js";

describe("buildTree", () => {
  it("renders a nested tree with directories first", () => {
    const tree = buildTree([
      "package.json",
      "README.md",
      "src/index.ts",
      "src/utils/logger.ts",
    ]);
    expect(tree).toBe(
      [
        ".",
        "├── src/",
        "│   ├── utils/",
        "│   │   └── logger.ts",
        "│   └── index.ts",
        "├── package.json",
        "└── README.md",
      ].join("\n"),
    );
  });

  it("returns just the root for an empty list", () => {
    expect(buildTree([])).toBe(".");
  });

  it("is deterministic regardless of input order", () => {
    const a = buildTree(["b.ts", "a.ts", "z/y.ts"]);
    const b = buildTree(["z/y.ts", "a.ts", "b.ts"]);
    expect(a).toBe(b);
  });
});
