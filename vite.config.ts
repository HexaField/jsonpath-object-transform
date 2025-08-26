import { defineConfig } from "vite";
import { viteCommonjs } from "@originjs/vite-plugin-commonjs";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";

export default defineConfig({
  root: "example",
  server: {
    port: 5173,
    open: true,
  },
  optimizeDeps: {
    exclude: ["jsonpath-object-transform"],
  },
  plugins: [viteCommonjs(), nodePolyfills(), NodeGlobalsPolyfillPlugin()],
});
