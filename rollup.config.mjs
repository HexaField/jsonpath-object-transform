import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";

/**
 * Build config:
 * - CJS build for Node consumers
 * - Keeps external dependencies external
 */
export default {
  input: "src/index.ts",
  output: [
    {
      file: "dist/index.js",
      format: "esm",
    },
  ],
  external: [
    // external runtime deps
  "jsonpath-plus",
    "JSONStream",
    "static-eval",
    "unpipe",
    "stream",
    "buffer",
    "util",
    "child_process",
  ],
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.build.json" }),
  ],
};
