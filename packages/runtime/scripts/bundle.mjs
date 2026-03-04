import { build } from "esbuild";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

await build({
  entryPoints: [resolve(root, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: resolve(root, "dist/runtime-bundle.mjs"),
  // node:sqlite is built-in, no native modules needed
  external: [
    "node:*",
    // These are dynamically required by optional deps and
    // don't need to be bundled:
    "bufferutil",
    "utf-8-validate",
  ],
  // Mark all node built-ins as external
  banner: {
    js: `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);`,
  },
  minify: false, // Keep readable for debugging
  sourcemap: true,
  logLevel: "info",
});

console.log("✓ Runtime bundled to dist/runtime-bundle.mjs");
