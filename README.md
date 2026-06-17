# git-context-pack

> Bundle your codebase into clean, token-efficient context for any LLM — with one command.

`git-context-pack` is a zero-friction CLI that walks your repository, respects your `.gitignore`, and packs the relevant files into a single, well-structured Markdown payload ready to paste into Claude, GPT, or any other model. No more manually copying files, re-explaining your project layout, or accidentally dumping `node_modules` into a context window.

---

## The Problem

Working with LLMs on real code means feeding them context, and today that process is painful:

- You copy and paste files one at a time, losing the directory structure that helps the model reason about your project.
- You forget which files matter and either under-share (the model lacks context) or over-share (you blow the token budget).
- You accidentally paste secrets from `.env`, or 50,000 lines of lockfile, or an entire `node_modules` tree.
- You have no idea whether what you pasted actually fits in the model's context window until it gets truncated.

These are small frictions, but they happen dozens of times a day for anyone doing AI-assisted development. `git-context-pack` removes them.

---

## What It Does

`git-context-pack` produces a deterministic, model-friendly bundle of your codebase:

1. **Smart traversal** — recursively reads your project while honoring `.gitignore`, so build artifacts, dependencies, and secrets are skipped automatically.
2. **Token-conscious filtering** — target a specific subdirectory, filter by file extension, or explicitly exclude heavy files so the output stays within budget.
3. **Structured Markdown output** — emits a project tree followed by each file's contents wrapped in clearly labeled, language-tagged code blocks, the format LLMs parse most reliably.
4. **Clipboard + token estimate** — optionally copies the finished payload straight to your clipboard and prints an approximate token count so you know whether it fits before you paste.

---

## Example Output

Running `git-context-pack` in a project produces something like this:

````markdown
# Codebase Context Bundle
Generated on: 2026-06-16

## Project Structure
```text
.
├── src/
│   ├── index.ts
│   └── utils/
│       └── logger.ts
├── package.json
└── README.md
```

## File Contents

### File: `package.json`
```json
{
  "name": "my-app",
  "dependencies": { ... }
}
```

### File: `src/utils/logger.ts`
```typescript
export const log = (msg: string) => console.log(msg);
```
````

The tree-first, tagged-files layout is intentional: models perform noticeably better when the hierarchy is shown up front and each file is delimited with its path and language.

---

## Quick Start

```bash
# Run directly without installing
npx git-context-pack

# Or install globally
npm install -g git-context-pack
git-context-pack
```

By default it bundles the current directory, respects `.gitignore`, prints the result, and reports an estimated token count.

---

## Usage

```bash
git-context-pack [options]
```

| Flag | Alias | Description |
|------|-------|-------------|
| `--dir <path>` | `-d` | Limit the bundle to a specific directory (e.g. `src/backend`). |
| `--ext <list>` | `-e` | Only include files with these extensions (e.g. `ts,js,json`). |
| `--exclude <glob>` | `-x` | Additional patterns to skip beyond `.gitignore`. |
| `--clipboard` | `-c` | Copy the final payload to the clipboard instead of (or alongside) printing. |
| `--output <file>` | `-o` | Write the bundle to a file. |

### Examples

```bash
# Pack only the backend, TypeScript and JSON files, straight to clipboard
git-context-pack --dir src/backend --ext ts,json --clipboard

# Pack the whole repo to a file
git-context-pack --output context.md
```

---

## Why Token Counts Matter

Every model has a finite context window. `git-context-pack` prints a rough estimate using a well-known heuristic — roughly **1 token ≈ 4 characters** of English/code text — so you get an instant sense of scale without pulling in a heavyweight tokenizer. If the estimate exceeds your target window, narrow the scope with `--dir` or `--ext` and try again.

---

## Design Principles

- **Respect the developer's intent.** Whatever Git ignores, the tool ignores. Your secrets and dependencies never end up in a prompt by accident.
- **Deterministic output.** The same repo produces the same bundle, so results are predictable and diff-able.
- **Lightweight and fast.** Minimal dependencies and asynchronous file walking keep it snappy even on large repositories.
- **Safe by default.** Binary files, oversized files, and circular symlinks are detected and handled gracefully rather than corrupting the output.

---

## Roadmap

- **Phase 1 — Core traversal engine.** Async recursive walker that filters every path through a `.gitignore`-aware matcher.
- **Phase 2 — Filtering & token estimation.** Extension targeting, custom excludes, and the character-based token estimate.
- **Phase 3 — Interactive focus mode.** An `interactive` command that lets you toggle which top-level directories or changed files (`git status`) to include before packing.

---

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **CLI parsing:** `commander` / `cac`
- **Gitignore logic:** `ignore`
- **Clipboard:** `clipboardy`
- **Terminal UX:** `picocolors` and `ora`

---

## License

MIT
