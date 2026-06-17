import path from "node:path";

/**
 * Maps a file extension (without the dot, lowercased) to the language tag
 * used in fenced Markdown code blocks. Unknown extensions return "" so the
 * fence is still valid, just untagged.
 */
const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "jsonc",
  md: "markdown",
  mdx: "markdown",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "fish",
  ps1: "powershell",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  ini: "ini",
  xml: "xml",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  vue: "vue",
  svelte: "svelte",
  dockerfile: "dockerfile",
  make: "makefile",
  r: "r",
  lua: "lua",
  dart: "dart",
  scala: "scala",
  ex: "elixir",
  exs: "elixir",
  clj: "clojure",
  proto: "protobuf",
};

/** Filenames (lowercased) that map to a language regardless of extension. */
const NAME_TO_LANG: Record<string, string> = {
  dockerfile: "dockerfile",
  makefile: "makefile",
  ".gitignore": "gitignore",
  ".dockerignore": "gitignore",
  ".npmrc": "ini",
  ".editorconfig": "ini",
};

/** Infer the Markdown language tag for a given file path. */
export function languageFor(relativePath: string): string {
  const base = path.basename(relativePath).toLowerCase();
  if (base in NAME_TO_LANG) return NAME_TO_LANG[base] ?? "";

  const ext = path.extname(base).slice(1);
  if (ext && ext in EXT_TO_LANG) return EXT_TO_LANG[ext] ?? "";

  return "";
}
