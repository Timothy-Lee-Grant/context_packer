import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { filterFiles } from "./filter.js";
import { resolveOptions } from "./config.js";
import type { FileEntry } from "./types.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "gcp-filter-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function make(rel: string, bytes: Buffer | string): Promise<FileEntry> {
  const abs = path.join(root, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, bytes);
  return {
    relativePath: rel,
    absolutePath: abs,
    size: Buffer.byteLength(bytes),
  };
}

describe("filterFiles", () => {
  it("keeps text and skips binary by content sniff", async () => {
    const text = await make("a.ts", "export const x = 1;");
    const binary = await make("img.dat", Buffer.from([0x00, 0x01, 0x02]));

    const result = await filterFiles([text, binary], resolveOptions({ root }));

    expect(result.kept.map((f) => f.relativePath)).toEqual(["a.ts"]);
    expect(result.skipped).toContainEqual({
      relativePath: "img.dat",
      reason: "binary",
    });
  });

  it("skips known binary extensions without reading", async () => {
    const png = await make("logo.png", "not really a png but ext wins");
    const result = await filterFiles([png], resolveOptions({ root }));
    expect(result.skipped[0]?.reason).toBe("binary");
  });

  it("applies extension targeting", async () => {
    const ts = await make("a.ts", "x");
    const js = await make("b.js", "y");
    const result = await filterFiles(
      [ts, js],
      resolveOptions({ root, extensions: ["ts"] }),
    );
    expect(result.kept.map((f) => f.relativePath)).toEqual(["a.ts"]);
    expect(result.skipped).toContainEqual({
      relativePath: "b.js",
      reason: "filtered",
    });
  });

  it("enforces the size cap", async () => {
    const big = await make("big.ts", "a".repeat(100));
    const result = await filterFiles(
      [big],
      resolveOptions({ root, maxFileSize: 10 }),
    );
    expect(result.skipped[0]?.reason).toBe("too-large");
  });

  it("scopes to a subdirectory", async () => {
    const inside = await make("src/in.ts", "x");
    const outside = await make("docs/out.ts", "y");
    const result = await filterFiles(
      [inside, outside],
      resolveOptions({ root, dir: "src" }),
    );
    expect(result.kept.map((f) => f.relativePath)).toEqual(["src/in.ts"]);
  });

  it("respects an explicit include set", async () => {
    const a = await make("src/a.ts", "x");
    const b = await make("docs/b.ts", "y");
    const c = await make("README.md", "z");
    const result = await filterFiles(
      [a, b, c],
      resolveOptions({ root, include: ["src", "README.md"] }),
    );
    expect(result.kept.map((f) => f.relativePath).sort()).toEqual([
      "README.md",
      "src/a.ts",
    ]);
  });
});
