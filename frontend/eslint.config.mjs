import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored MapLibre worker bundles. They are third-party, already
    // minified, and served straight from public/ so the map does not fetch a
    // worker from a CDN at runtime. Linting a minified bundle reports
    // thousands of style warnings about code we neither wrote nor edit.
    "public/maplibre/**",
  ]),
]);

export default eslintConfig;
