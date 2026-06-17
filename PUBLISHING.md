# Publishing & Using git-context-pack

A complete, copy-paste walkthrough for taking this repository from your machine to a live, installable npm package — and then actually using it. Written so you can follow it the first time without prior npm-publishing experience.

---

## Overview: What "publishing" actually means

When you run `npm publish`, the npm CLI does three things:

1. Builds a tarball (`.tgz`) containing only the files allowed by the `files` field in `package.json` (here: `dist/`, `README.md`, `LICENSE`).
2. Uploads that tarball to the npm registry (`registry.npmjs.org`) under your package name and version.
3. Makes it installable worldwide via `npm install git-context-pack` or runnable via `npx git-context-pack`.

The package is keyed by **name + version**. You can never republish the same version, so every release gets a new version number.

```text
your machine            npm registry              any user
┌────────────┐  publish ┌──────────────┐  install ┌──────────┐
│ dist/ +    ├─────────▶│ git-context- ├─────────▶│ npx runs │
│ README +   │          │ pack@0.1.0   │          │ your CLI │
│ LICENSE    │          └──────────────┘          └──────────┘
└────────────┘
```

---

## Part A — One-time setup

### A1. Create an npm account

Go to <https://www.npmjs.com/signup> and create an account. Verify your email (npm blocks publishing from unverified accounts).

### A2. Enable two-factor auth (strongly recommended)

In npm → Account → Two-Factor Authentication, enable 2FA for "Authorization and Publishing." This protects your package from being hijacked.

### A3. Log in from your terminal

```bash
npm login
```

Enter your username, password, and the 2FA one-time code. Confirm it worked:

```bash
npm whoami        # should print your username
```

### A4. Pick a package name that's free

The name in `package.json` is currently `git-context-pack`. Check availability:

```bash
npm view git-context-pack
```

- If it prints `404 Not Found`, the name is free — you're good.
- If it shows a package, the name is taken. Either choose another name, or publish under your own scope (recommended for portfolio projects):

```jsonc
// package.json
"name": "@spacebunny/git-context-pack"
```

A scoped name is always available to you because it lives under your username. Scoped packages are **private by default**, so you must publish them as public (covered in B4).

---

## Part B — Releasing a version

### B1. Make sure the working tree is clean and correct

```bash
npm install                 # install dependencies
npm run lint                # style
npm run typecheck           # types
npm test                    # all behaviors pass
npm run build               # produces dist/
```

All five must succeed. The `prepublishOnly` script in `package.json` re-runs lint + typecheck + test + build automatically on publish, so a broken build cannot be released — but running them yourself first gives faster feedback.

### B2. Verify what will actually ship

This is the single most important pre-publish habit. It shows the exact file list of the tarball **without uploading anything**:

```bash
npm pack --dry-run
```

Expect to see only `dist/**`, `README.md`, `LICENSE`, and `package.json`. If you see `src/`, `.env`, test files, or anything secret, stop and fix the `files` field before continuing. (You can also create a real tarball with `npm pack` and inspect it with `tar -tzf git-context-pack-0.1.0.tgz`.)

### B3. Set the version

npm versions follow **Semantic Versioning**: `MAJOR.MINOR.PATCH`.

| Bump | Command | When |
|------|---------|------|
| Patch | `npm version patch` | Bug fixes, no API change (0.1.0 → 0.1.1) |
| Minor | `npm version minor` | New backward-compatible features (0.1.0 → 0.2.0) |
| Major | `npm version major` | Breaking changes (0.1.0 → 1.0.0) |

`npm version` edits `package.json`, creates a git commit, and tags it. For your very first release you can leave it at `0.1.0` and skip this step, or run `npm version 0.1.0 --no-git-tag-version` to set it explicitly.

> Pre-1.0.0 convention: while the package is `0.x`, you're signalling "still stabilizing," and minor bumps are allowed to break things. Reach `1.0.0` when you consider the CLI's flags stable.

### B4. Publish

For an unscoped package:

```bash
npm publish
```

For a scoped package (e.g. `@spacebunny/git-context-pack`), you must explicitly mark it public, or npm will try to publish it as a paid private package and fail:

```bash
npm publish --access public
```

You'll be prompted for your 2FA code. On success npm prints the package name, version, and file count.

### B5. Confirm it's live

```bash
npm view git-context-pack          # shows the published metadata
npx git-context-pack@latest --help # downloads and runs it fresh
```

Visit `https://www.npmjs.com/package/git-context-pack` to see the public page (your README renders there automatically).

---

## Part C — Using the published tool

### C1. Run without installing (recommended for a CLI)

```bash
npx git-context-pack            # pack the current repo to stdout
npx git-context-pack -c         # copy to clipboard
npx git-context-pack interactive
```

`npx` downloads the latest version, runs it, and caches it. This is how most people will use a CLI like this.

### C2. Install globally

```bash
npm install -g git-context-pack
git-context-pack --help
```

Now `git-context-pack` is on your `PATH` in every shell.

### C3. Add to a project as a dev dependency

```bash
npm install --save-dev git-context-pack
```

Then add a script to that project's `package.json`:

```jsonc
"scripts": {
  "context": "git-context-pack -d src -c"
}
```

and run `npm run context`.

---

## Part D — Shipping updates

The release loop after the first publish:

```bash
# 1. make your changes, then:
npm run lint && npm run typecheck && npm test && npm run build
npm pack --dry-run            # sanity-check the file list
npm version patch             # or minor / major
npm publish                   # (--access public if scoped)
git push && git push --tags   # push the version commit + tag to GitHub
```

Users pick up the new version automatically with `npx git-context-pack@latest`, or `npm update -g git-context-pack` if globally installed.

---

## Part E — Automating publish from GitHub (optional, advanced)

Once comfortable, you can let GitHub Actions publish on every tagged release so you never publish from your laptop:

1. Create an npm **automation access token**: npm → Access Tokens → Generate New Token → "Automation" (this type bypasses the interactive 2FA prompt).
2. In your GitHub repo: Settings → Secrets and variables → Actions → New repository secret, named `NPM_TOKEN`.
3. Add a release workflow:

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ["v*"]
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write          # enables npm provenance
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Now `npm version patch && git push --tags` triggers an automated, provenance-signed publish. (`--provenance` cryptographically links the published package to the exact GitHub commit and workflow that built it — a strong supply-chain signal that looks great on a portfolio project.)

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `403 Forbidden` on publish | Name taken, or not logged in, or unverified email | `npm whoami`; verify email; choose another/scoped name |
| `402 Payment Required` | Publishing a scoped package without `--access public` | Add `--access public` |
| `You cannot publish over the previously published version` | Version already exists | Bump with `npm version patch` |
| `npm ERR! need auth` | Not logged in / token expired | `npm login` again |
| Tarball includes `src/` or secrets | `files` field wrong or missing | Fix `files` in `package.json`, re-run `npm pack --dry-run` |
| `command not found` after global install | npm global bin not on `PATH` | Add `$(npm config get prefix)/bin` to your `PATH` |
| Published but `npx` runs old code | npx cache | `npx git-context-pack@latest` or `npm cache clean --force` |

---

## Pre-publish checklist

```text
[ ] npm whoami succeeds (logged in)
[ ] package name is free or scoped to you
[ ] version is correct and not already published
[ ] npm run lint / typecheck / test / build all pass
[ ] npm pack --dry-run shows ONLY dist/, README.md, LICENSE, package.json
[ ] README renders correctly (preview it)
[ ] LICENSE present with your name
[ ] git committed and tagged
[ ] npm publish (--access public if scoped)
[ ] npx git-context-pack@latest --help works from a clean shell
```
