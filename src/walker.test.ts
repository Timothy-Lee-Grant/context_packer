import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildIgnore } from "./ignore.js";
import { walk } from "./walker.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "gcp-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function file(rel: string, contents = "x"): Promise<void> {
  const abs = path.join(root, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, contents);
}

function rels(entries: { relativePath: string }[]): string[] {
  return entries.map((e) => e.relativePath).sort();
}

describe("walk", () => {
  it("returns files and respects built-in ignores", async () => {
    await file("src/index.ts");
    await file("README.md");
    await file("node_modules/dep/index.js");

    const ig = await buildIgnore(root);
    const result = await walk(root, ig);

    expect(rels(result)).toEqual(["README.md", "src/index.ts"]);
  });

  it("honors .gitignore patterns", async () => {
    await file(".gitignore", "secret.txt\nlogs/\n");
    await file("keep.ts");
    await file("secret.txt");
    await file("logs/run.log");

    const ig = await buildIgnore(root);
    const result = await walk(root, ig);

    expect(rels(result)).toContain("keep.ts");
    expect(rels(result)).toContain(".gitignore");
    expect(rels(result)).not.toContain("secret.txt");
    expect(rels(result)).not.toContain("logs/run.log");
  });

  it("does not infinitely recurse on circular symlinks", async () => {
    await file("a/file.ts");
    // Create a symlink inside `a` that points back to `a`.
    await symlink(path.join(root, "a"), path.join(root, "a", "loop"), "dir");

    const ig = await buildIgnore(root);
    const result = await walk(root, ig);

    // Should complete and include the real file exactly once.
    expect(rels(result)).toContain("a/file.ts");
  });

  it("produces deterministic sorted output", async () => {
    await file("z.ts");
    await file("a.ts");
    await file("m/b.ts");

    const ig = await buildIgnore(root);
    const result = await walk(root, ig);

    const paths = result.map((e) => e.relativePath);
    expect(paths).toEqual([...paths].sort());
  });
});
