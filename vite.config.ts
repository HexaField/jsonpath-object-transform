import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { viteCommonjs } from '@originjs/vite-plugin-commonjs'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  root: 'example',
  server: {
    port: 5173,
    open: true
  },
  optimizeDeps: {
    exclude: ['@hexafield/jsonpath-object-transform']
  },
  plugins: [viteCommonjs(), nodePolyfills(), NodeGlobalsPolyfillPlugin()]
})
