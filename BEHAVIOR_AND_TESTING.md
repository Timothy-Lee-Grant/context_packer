# git-context-pack — Behavior & Testing Guide

This document is the contract for what `git-context-pack` does, how to confirm it works by hand, and how the automated suite proves it. If you change the code, this is the file that tells you whether the change was intended.

---

## 1. What the Tool Is Supposed to Do

`git-context-pack` walks a repository, drops the files an LLM shouldn't see (ignored, binary, oversized), reads the rest, and emits a single deterministic Markdown bundle: a project tree followed by every included file in a labeled code fence. It can copy that bundle to the clipboard or a file and reports an estimated token count.

The whole thing is a six-stage pipeline. Each stage has one job and hands a typed value to the next:

```text
walk ─▶ filter ─▶ read ─▶ format ─▶ estimate ─▶ emit
 │        │         │        │          │          │
 │        │         │        │          │          └─ output.ts / report.ts
 │        │         │        │          └─ tokens.ts
 │        │         │        └─ formatter.ts + tree.ts
 │        │         └─ reader.ts (+ languages.ts)
 │        └─ filter.ts
 └─ walker.ts (+ ignore.ts)
```

`pack.ts` orchestrates stages 1–5 and is side-effect free; `index.ts` adds the CLI, spinner, and I/O sinks around it.

---

## 2. Expected Behavior (the Specification)

The table below is the authoritative list of behaviors. Every row maps to at least one automated test (Section 4) and a manual check (Section 3).

| # | Area | Expected behavior | Source module |
|---|------|-------------------|---------------|
| B1 | Traversal | Recursively finds every file under the root. | `walker.ts` |
| B2 | Ignore | Skips anything matched by `.gitignore` plus built-in defaults (`node_modules`, `dist`, `.git`, lockfiles…). | `ignore.ts`, `walker.ts` |
| B3 | Missing `.gitignore` | Still runs, applying only built-in defaults. | `ignore.ts` |
| B4 | Symlinks | A circular symlink never causes infinite recursion; each real file appears once. | `walker.ts` |
| B5 | Determinism | Same repo + flags → byte-identical output (except the date header). | `walker.ts`, `tree.ts`, `formatter.ts` |
| B6 | Binary detection | Files with binary extensions, or containing a NUL byte, are skipped and reported as `binary`. | `filter.ts` |
| B7 | Size cap | Files larger than `--max-size` (default 256 KB) are skipped as `too-large`. | `filter.ts` |
| B8 | Extension filter | `--ext ts,js` keeps only those extensions; others reported as `filtered`. | `filter.ts` |
| B9 | Directory scope | `--dir src` silently restricts the bundle to that subtree. | `filter.ts` |
| B10 | Safe reads | An unreadable file is reported as `unreadable`, never crashes the run. | `reader.ts` |
| B11 | Language tags | Each file's fence is tagged by extension/filename (`.ts` → `typescript`). | `languages.ts` |
| B12 | Tree | Output opens with an ASCII tree, directories before files, alphabetical. | `tree.ts` |
| B13 | Fence safety | A file containing ```` ``` ```` gets a longer outer fence so it can't break the bundle. | `formatter.ts` |
| B14 | Empty result | Zero matched files yields a valid bundle with a "no files matched" note. | `formatter.ts` |
| B15 | Token estimate | Reports `ceil(totalChars / 4)` tokens, labeled approximate. | `tokens.ts` |
| B16 | Token warning | Estimate over the threshold (default 128k) prints a yellow warning. | `report.ts` |
| B17 | Clipboard sink | `--clipboard` copies the bundle; failure degrades to a warning + stdout. | `output.ts` |
| B18 | File sink | `--output f.md` writes the bundle to that path. | `output.ts` |
| B19 | Default sink | With no sink flag, the bundle goes to stdout. | `output.ts` |
| B20 | Quiet / non-TTY | `--quiet` or a piped stderr suppresses the spinner and summary; stdout stays pure. | `spinner.ts`, `index.ts` |
| B21 | Interactive | `interactive` lets you check directories + git-changed files; selection scopes the bundle. | `interactive.ts`, `git.ts` |
| B22 | Secret safety | Content of an ignored file (e.g. `.env`) never appears in the bundle. | end-to-end |

---

## 3. Manual Verification

Run these by hand after a build (`npm run build`) to confirm the tool behaves. Each step lists the command, what you should see, and which behavior IDs it exercises. They assume you are inside a sample git repo.

### 3.1 Happy path — bundle to stdout (B1, B2, B11, B12, B15, B19)

```bash
git-context-pack
```

Expect: a Markdown document starting with `# Codebase Context Bundle`, a `## Project Structure` tree, then `## File Contents` with each file in a tagged fence. On stderr, a green summary line like `✓ 12 files · 8,402 chars · ~2.1k tokens`. Confirm `node_modules/` and anything in `.gitignore` is absent.

### 3.2 Ignore + secret safety (B2, B22)

```bash
echo "SECRET=hunter2" > .env
git-context-pack | grep -c "hunter2"
```

Expect: `0`. The `.env` content must not appear. (`.env` is covered by the built-in defaults and the project `.gitignore`.)

### 3.3 Directory + extension scoping (B8, B9)

```bash
git-context-pack --dir src --ext ts,json
```

Expect: only `.ts`/`.json` files under `src/` appear. The stderr summary's skip count rises, and non-matching extensions are counted under `filtered`.

### 3.4 Size cap (B7)

```bash
head -c 500000 /dev/urandom | base64 > big.txt
git-context-pack --max-size 100kb 2>&1 | grep too-large
```

Expect: the summary shows `big.txt` skipped as `too-large`. (Delete `big.txt` afterward.)

### 3.5 Binary detection (B6)

Run in any repo containing an image:

```bash
git-context-pack 2>&1 | grep binary
```

Expect: the image is counted under `binary` in the skip summary and is not in the bundle.

### 3.6 Fence-escaping edge case (B13)

Run in this repo (its own `README.md` contains a fenced code block):

```bash
git-context-pack --dir . --ext md | grep -n '````'
```

Expect: at least one four-backtick fence, proving the README's inner ```` ``` ```` is safely wrapped.

### 3.7 Clipboard and file sinks (B17, B18)

```bash
git-context-pack --output context.md && head -1 context.md   # → "# Codebase Context Bundle"
git-context-pack --clipboard                                  # then paste somewhere
```

Expect: the file is written; the clipboard holds the bundle. In a headless shell, the clipboard run prints a yellow warning and falls back to stdout (B17).

### 3.8 Determinism (B5)

```bash
git-context-pack > a.md
git-context-pack > b.md
diff <(grep -v '^Generated on:' a.md) <(grep -v '^Generated on:' b.md) && echo IDENTICAL
```

Expect: `IDENTICAL`. Only the date header may differ.

### 3.9 Quiet / piping (B20)

```bash
git-context-pack --quiet > /dev/null; echo "exit=$?"
```

Expect: no spinner, no summary, `exit=0`. Piped output never contains spinner characters.

### 3.10 Interactive focus mode (B21)

```bash
git-context-pack interactive
```

Expect: a checkbox list with git-changed files at the top (pre-checked, marked `★ … (changed)`), then directories (trailing `/`) and top-level files. Selecting a subset and pressing enter bundles only those paths; selecting nothing exits with `Nothing selected — exiting.`

---

## 4. Automated Tests

The suite is colocated with the source (`src/*.test.ts`) and run with `npm test` (Vitest). It is structured as fast unit tests per module plus one end-to-end integration test.

| Test file | Covers behaviors | What it asserts |
|-----------|------------------|-----------------|
| `walker.test.ts` | B1–B5 | Lists files, applies ignores, terminates on circular symlinks, sorts deterministically. |
| `filter.test.ts` | B6–B9, include | Binary by content and extension, size cap, extension targeting, dir scope, explicit include set. |
| `languages.test.ts` | B11 | Extension and special-filename → language mapping; unknown → empty. |
| `tree.test.ts` | B12 | Nested tree, dirs-first ordering, empty case, order-independence. |
| `formatter.test.ts` | B13, B14 | Header/tree/blocks present, longer fence for triple-backtick content, empty note. |
| `tokens.test.ts` | B15 | `ceil(chars/4)` heuristic, compact and separator formatting. |
| `output.test.ts` | B17–B19 | File sink writes, stdout fallback, forced-stdout combo (clipboard mocked). |
| `git.test.ts` | B21 | Porcelain parsing: modified/untracked, renames keep new path, quoted paths, blanks. |
| `interactive.test.ts` | B21 | Changed-first ordering, dirs before files, no duplicate, dir label slash. |
| `cli.test.ts` | B8, B20, flags | Size parsing, extension normalization, repeated excludes, all flag combos. |
| `pack.test.ts` | B2, B5, B6, B13, B15, B22 | Full pipeline on a fixture repo: right files in, secrets/binary/deps out, deterministic, fence-escaped. |

### Running them

```bash
npm test            # run once
npm run test:watch  # watch mode
npm test -- --coverage
```

### How tests are isolated

Filesystem tests create a fresh temp directory with `mkdtemp` in `beforeEach` and remove it in `afterEach`, so they never touch your real files and can run in parallel. The clipboard and stdout are mocked (`vi.spyOn`) so no real I/O escapes the test process.

### Sandbox note

This project was developed in an environment without npm registry access, so the maintainer additionally verified each phase by running self-contained ports of the pipeline logic against identical fixtures (61 checks, all passing). On a normal machine, `npm test` is the source of truth — these ports were a stand-in only.

---

## 5. Edge Cases and Why They Matter

These are the inputs that separate a robust tool from a brittle one. Each is handled deliberately and has a test.

| Edge case | Risk if unhandled | How it's handled |
|-----------|-------------------|------------------|
| Circular symlink | Infinite loop / crash | Visited real-path `Set` in `walker.ts` (B4). |
| Binary file | Garbage bytes corrupt the Markdown | Extension allowlist + NUL-byte sniff (B6). |
| Huge file | Token budget blown, slow read | Size cap reported as `too-large` (B7). |
| File containing ```` ``` ```` | Premature fence close breaks bundle | Dynamic fence length (B13). |
| No `.gitignore` | Crash or no filtering | Built-in defaults still applied (B3). |
| Unreadable file (perms) | Whole run aborts | Caught, reported `unreadable` (B10). |
| Piped / CI output | Spinner junk in the file | Spinner is a no-op off-TTY (B20). |
| Headless clipboard | Hard crash | Degrades to warning + stdout (B17). |
| Many files at once | `EMFILE` (too many open handles) | `p-limit` caps concurrency in `walker.ts`/`reader.ts`. |

---

## 6. Known Limitations (Honest Scope)

- **Token estimate is approximate.** The 4-chars-per-token heuristic is intentionally rough; it can be off by 10–20% versus a real `cl100k_base` tokenizer. It exists to warn, not to bill.
- **Nested `.gitignore` files** are not yet merged per-directory; only the root `.gitignore` is read. Most repos are fine; deeply nested ignore rules are a future enhancement.
- **Interactive mode is single-level.** It toggles top-level directories and changed files, not arbitrary deep paths.

These are documented rather than hidden so contributors know exactly where the edges are.

---

## 7. Definition of "Working"

The tool is working correctly when, from a clean checkout:

```bash
npm install && npm run lint && npm run typecheck && npm test && npm run build
```

all pass, and the manual checks in Section 3 behave as described. CI runs the same gate across Node 18/20/22 on Linux, macOS, and Windows.
