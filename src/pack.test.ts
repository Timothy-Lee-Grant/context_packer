import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveOptions } from "./config.js";
import { pack } from "./pack.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "gcp-pack-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function write(rel: string, contents: Buffer | string): Promise<void> {
  const abs = path.join(root, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, contents);
}

describe("pack (integration)", () => {
  it("bundles a realistic repo end to end", async () => {
    await write(".gitignore", "ignored.txt\n");
    await write("package.json", '{\n  "name": "demo"\n}\n');
    await write("src/index.ts", "export const x = 1;\n");
    await write("src/utils/logger.ts", "export const log = () => {};\n");
    await write("README.md", "Code:\n```js\nx\n```\n"); // triple-backtick edge case
    await write("ignored.txt", "TOPSECRET_CONTENT");
    await write("node_modules/dep/index.js", "module.exports = {};");
    await write("logo.png", Buffer.from([0x00, 0x01, 0x02])); // binary

    const result = await pack(resolveOptions({ root }));

    // Included the right files (.gitignore is itself a tracked source file).
    expect(result.fileCount).toBe(5);
    expect(result.bundle).toContain("### File: `.gitignore`");
    expect(result.bundle).toContain("### File: `package.json`");
    expect(result.bundle).toContain("### File: `src/index.ts`");
    expect(result.bundle).toContain("### File: `src/utils/logger.ts`");
    expect(result.bundle).toContain("### File: `README.md`");

    // Excluded files get no block, and their content never leaks.
    expect(result.bundle).not.toContain("### File: `ignored.txt`");
    expect(result.bundle).not.toContain("TOPSECRET_CONTENT");
    expect(result.bundle).not.toContain("### File: `node_modules");
    expect(result.bundle).not.toContain("### File: `logo.png`");

    // Structure + header present.
    expect(result.bundle).toContain("# Codebase Context Bundle");
    expect(result.bundle).toContain("## Project Structure");
    expect(result.bundle).toMatch(/├── |└── /);

    // Triple-backtick content is escaped with a longer fence.
    expect(result.bundle).toContain("````markdown");

    // Token estimate is sane (roughly chars / 4).
    expect(result.tokenEstimate).toBe(Math.ceil(result.bundle.length / 4));

    // Binary file was reported as skipped.
    expect(result.skipped).toContainEqual({
      relativePath: "logo.png",
      reason: "binary",
    });
  });

  it("is deterministic across runs", async () => {
    await write("b.ts", "export const b = 2;\n");
    await write("a.ts", "export const a = 1;\n");
    await write("nested/c.ts", "export const c = 3;\n");

    const opts = resolveOptions({ root });
    const first = await pack(opts);
    const second = await pack(opts);

    // Strip the date header line, which legitimately changes day to day.
    const strip = (s: string) => s.replace(/^Generated on: .*$/m, "");
    expect(strip(first.bundle)).toBe(strip(second.bundle));
  });

  it("honors extension and dir scoping together", async () => {
    await write("src/keep.ts", "1");
    await write("src/skip.js", "2");
    await write("docs/out.ts", "3");

    const result = await pack(
      resolveOptions({ root, dir: "src", extensions: ["ts"] }),
    );

    expect(result.fileCount).toBe(1);
    expect(result.bundle).toContain("src/keep.ts");
    expect(result.bundle).not.toContain("src/skip.js");
    expect(result.bundle).not.toContain("docs/out.ts");
  });
});
