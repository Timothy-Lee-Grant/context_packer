import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  clean: true,
  dts: false,
  sourcemap: true,
  // Preserve the shebang so the built file is directly executable.
  banner: {
    js: "#!/usr/bin/env node",
  },
});
