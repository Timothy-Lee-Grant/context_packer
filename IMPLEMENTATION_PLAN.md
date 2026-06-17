# git-context-pack — Implementation Plan

A detailed, phased roadmap for building `git-context-pack` from an empty directory to a polished, publishable npm package. Each phase lists its goals, the concrete tasks, the recommended tools, and the acceptance criteria that mark it done.

---

## Guiding Principles

These hold across every phase and should be the tie-breaker whenever a decision is unclear.

- **Deterministic output.** The same repository and flags always produce byte-identical output. This makes the tool diff-able, testable, and trustworthy.
- **Respect the developer's intent.** Whatever Git ignores, the tool ignores. Secrets and dependencies must never reach a prompt by accident.
- **Fail soft, never corrupt.** Binary files, oversized files, unreadable paths, and circular symlinks are handled gracefully and reported, never silently mangled into the output.
- **Lightweight and async.** Minimal dependencies; non-blocking file I/O so large repositories stay fast.
- **Elegant ergonomics.** Sensible defaults mean `git-context-pack` with no flags does the right thing. Flags exist for control, not as a requirement.

---

## Architecture Overview

A single-responsibility module per concern keeps the codebase clean and testable.

```text
src/
├── index.ts          # CLI entry — parses args, orchestrates the pipeline
├── cli.ts            # Flag/command definitions and validation
├── config.ts         # Resolves defaults + flags into a single Options object
├── walker.ts         # Async recursive traversal with ignore filtering
├── ignore.ts         # Loads .gitignore + built-in defaults into a matcher
├── filter.ts         # Extension targeting, size caps, binary detection
├── reader.ts         # Safe file reading + language tag inference
├── tree.ts           # Builds the ASCII project-structure tree
├── formatter.ts      # Assembles the final Markdown bundle
├── tokens.ts         # Character-based token estimation
├── output.ts         # Clipboard / file / stdout sinks
└── types.ts          # Shared types (Options, FileEntry, BundleResult)
```

The data flow is a clean pipeline: `walk → filter → read → format → estimate → emit`. Each stage takes a typed input and returns a typed output, which makes every stage independently unit-testable.

---

## Phase 0 — Project Scaffolding

**Goal:** A buildable, lintable, testable TypeScript package skeleton.

| Task | Tool / Choice |
|------|---------------|
| Initialize `package.json` with `bin` field pointing at the compiled entry | `npm init`, manual edit |
| Add TypeScript config (strict mode, ES2022 target, `NodeNext` modules) | `typescript`, `tsconfig.json` |
| Configure build (fast bundle + type declarations) | `tsup` |
| Set up linting and formatting | `eslint`, `prettier` |
| Set up the test runner | `vitest` |
| Add a `shebang` (`#!/usr/bin/env node`) to the entry so the CLI is executable | manual |
| Add npm scripts: `build`, `dev`, `test`, `lint`, `typecheck` | `package.json` |

**Acceptance:** `npm run build` emits a runnable binary; `npm test` runs (even with zero tests); `npm run lint` and `typecheck` pass clean.

---

## Phase 1 — Core Traversal Engine

**Goal:** Walk a directory recursively, honoring `.gitignore`, and return a clean list of candidate file paths.

| Task | Tool / Choice |
|------|---------------|
| Implement async recursive walker over `fs.promises.readdir(..., { withFileTypes: true })` | Node `fs/promises` |
| Load the root `.gitignore` (and nested ones, if present) into a matcher | `ignore` |
| Layer built-in always-skip defaults (`.git`, `node_modules`, common lockfiles) on top of `.gitignore` | `ignore` |
| Pass every discovered path through the matcher; skip on match | `ignore` |
| Detect and break circular symlinks via a visited real-path set | `fs.realpath`, `Set` |
| Parallelize directory reads where safe without exhausting file handles | `Promise.all` + a small concurrency limiter (`p-limit`) |
| Return a sorted, deterministic `FileEntry[]` | manual sort |

**Why these tools:** `ignore` is the same library ESLint uses for `.gitignore` semantics, so edge cases (negation patterns, trailing slashes, comments) behave exactly as developers expect. `p-limit` prevents `EMFILE` crashes on huge trees while keeping the walk concurrent.

**Acceptance:** Running on a sample repo lists exactly the files `git ls-files` would, minus binaries — verified by an automated test against a fixture repo.

---

## Phase 2 — Filtering, Reading & Safety

**Goal:** Turn the candidate list into safe, readable text entries with correct language tags.

| Task | Tool / Choice |
|------|---------------|
| Extension targeting (`--ext ts,js,json`) and directory scoping (`--dir src/backend`) | `config.ts` resolution + `picomatch` for globs |
| Binary-file detection (skip images, fonts, compiled artifacts) | null-byte sniff on first chunk + extension allowlist |
| Per-file size cap with a clear "skipped: too large" notice | `fs.stat` |
| Safe reads that catch permission/encoding errors and report instead of crashing | `fs.readFile`, try/catch |
| Map file extensions to Markdown language tags (`.ts → typescript`) | small lookup table |
| Collect skipped-file diagnostics (reason per file) for an end-of-run summary | accumulator in `BundleResult` |

**Acceptance:** Feeding a repo containing a PNG, a 10 MB CSV, and a normal `.ts` file yields only the `.ts` content, with the other two listed in a "skipped" report and reasons attached.

---

## Phase 3 — Tree & Markdown Formatting

**Goal:** Produce the deterministic, LLM-optimized bundle described in the README.

| Task | Tool / Choice |
|------|---------------|
| Build the ASCII directory tree from the final file set | custom `tree.ts` (no dependency needed) |
| Assemble the bundle: title + timestamp, `## Project Structure`, then `## File Contents` | `formatter.ts` |
| Wrap each file in a fenced block tagged with path and language | template strings |
| Guard against content containing triple backticks (use longer fences when needed) | dynamic fence length |
| Keep ordering stable (directories first, alphabetical) so output is reproducible | shared comparator |

**Why tree-first, tagged-files:** models reason about a project far better when the hierarchy is shown up front and each file is delimited with an explicit path and language. The format mirrors the README's example exactly.

**Acceptance:** Snapshot tests confirm the output matches a golden file byte-for-byte for a fixture repo, including the backtick-escaping edge case.

---

## Phase 4 — Token Estimation & Output Sinks

**Goal:** Report scale and deliver the payload wherever the user wants it.

| Task | Tool / Choice |
|------|---------------|
| Character-based token estimate (~1 token ≈ 4 chars) with a clear "approximate" label | `tokens.ts`, no heavy tokenizer |
| Print a summary line: file count, char count, estimated tokens, skipped count | `picocolors` |
| Warn (colored) when the estimate exceeds a configurable window threshold | `picocolors` |
| Copy to clipboard with `--clipboard` | `clipboardy` |
| Write to a file with `--output <file>` | `fs/promises` |
| Default to stdout when neither sink is chosen | manual |
| Show a spinner during traversal of large repos | `ora` |

**Acceptance:** Each sink works in isolation and in combination; the token estimate is within a sane margin of a reference `tiktoken` count on sample text (validated in a dev-only test, not shipped).

---

## Phase 5 — CLI Layer & UX Polish

**Goal:** A friendly, discoverable command-line interface.

| Task | Tool / Choice |
|------|---------------|
| Define flags and the `interactive` subcommand | `commander` (or `cac`) |
| Validate flag combinations and emit helpful errors | `cli.ts` |
| Rich `--help` with examples | `commander` built-in |
| Colorized success/warn/error output | `picocolors` |
| Respect `NO_COLOR` and non-TTY environments (disable spinner/colors when piped) | env checks |

**Acceptance:** `git-context-pack --help` reads cleanly; invalid input produces actionable messages, not stack traces; output stays clean when piped to a file.

---

## Phase 6 — Interactive "Focus" Mode

**Goal:** Let users visually choose what to include before packing.

| Task | Tool / Choice |
|------|---------------|
| `git-context-pack interactive` launches a checkbox UI of top-level dirs | `@inquirer/prompts` (or `prompts`) |
| Optionally surface changed files via `git status --porcelain` for quick selection | child_process / `simple-git` |
| Feed the selection back into the same pipeline as flag-driven runs | reuse `config.ts` |

**Acceptance:** Toggling directories in the prompt visibly changes which files appear in the resulting bundle; selecting nothing exits cleanly.

---

## Phase 7 — Testing, Hardening & Release

**Goal:** Confidence to publish and maintain.

| Task | Tool / Choice |
|------|---------------|
| Unit tests per module (walker, ignore, filter, formatter, tokens) | `vitest` |
| Fixture-repo integration tests covering edge cases (symlinks, binaries, nested gitignores, backticks) | `vitest` + temp dirs |
| Snapshot test for the full golden output | `vitest` snapshots |
| Cross-platform sanity (path separators, clipboard) on macOS/Linux/Windows | CI matrix |
| CI pipeline: lint → typecheck → test → build | GitHub Actions |
| Pre-publish checks and changelog | `np` or `changesets` |
| README usage verified against actual flag behavior | manual review |

**Acceptance:** Green CI on all platforms; `npm pack` contains only `dist/`, README, and license; a dry-run install (`npx ./package.tgz`) works end-to-end.

---

## Edge Cases to Handle Explicitly

These are the details that separate a polished tool from a brittle one, and each should have a dedicated test.

- **Circular symlinks** — track visited real paths; never recurse twice.
- **Binary files** — null-byte detection so images/fonts/compiled output never render as garbage.
- **Oversized files** — size cap with a reported skip, configurable via flag.
- **Empty directories** — represented correctly (or omitted) in the tree without breaking it.
- **Triple-backtick collisions** — dynamically lengthen code fences so file content can't break the Markdown.
- **No `.gitignore` present** — fall back to built-in defaults without erroring.
- **Non-TTY / piped output** — disable spinner and color automatically.
- **Huge repos** — concurrency-limited walking so the process never exhausts file handles or memory.

---

## Dependency Summary

| Concern | Library | Why |
|---------|---------|-----|
| CLI parsing | `commander` / `cac` | Battle-tested flag and subcommand handling |
| Gitignore logic | `ignore` | Exact `.gitignore` semantics, same as ESLint |
| Glob matching | `picomatch` | Fast, dependency-light pattern matching |
| Concurrency control | `p-limit` | Prevents file-handle exhaustion on big trees |
| Clipboard | `clipboardy` | Cross-platform copy |
| Terminal color | `picocolors` | Tiny, fast, `NO_COLOR`-aware |
| Spinner | `ora` | Clean progress feedback |
| Interactive prompts | `@inquirer/prompts` | Checkbox UI for focus mode |
| Build | `tsup` | Zero-config TS bundling + declarations |
| Tests | `vitest` | Fast, TS-native, great snapshot support |

Everything here is small and widely used; the runtime footprint stays light, which keeps install and startup fast.

---

## Suggested Milestones

A realistic sequencing for a portfolio build, where each milestone is independently demoable:

1. **Walking skeleton** (Phases 0–1) — walks a repo, prints a filtered file list.
2. **Usable v0.1** (Phases 2–4) — produces the full Markdown bundle with token count and clipboard support.
3. **Polished v1.0** (Phases 5–7) — friendly CLI, interactive mode, full test suite, published to npm.

---

## Definition of Done

The project is complete when a developer can run `npx git-context-pack` in any repository and, with zero configuration, receive a clean, `.gitignore`-respecting, token-counted Markdown bundle copied to their clipboard — and when the test suite proves every edge case above is handled. At that point the repository also stands as a strong portfolio piece, demonstrating file-system architecture, careful edge-case handling, async performance awareness, and genuine developer empathy.
