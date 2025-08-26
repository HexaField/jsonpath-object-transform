import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'esm'
    }
  ],
  external: ['jsonpath-plus', 'JSONStream', 'static-eval', 'unpipe', 'stream', 'buffer', 'util', 'child_process'],
  plugins: [resolve({ preferBuiltins: true }), commonjs(), typescript({ tsconfig: './tsconfig.build.json' })]
}
