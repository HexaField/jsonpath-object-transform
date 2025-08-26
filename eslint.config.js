// @ts-check
import js from '@eslint/js'
import globals from 'globals'

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.mocha,
        define: 'readonly'
      }
    },
    rules: {
      // Keep rules pragmatic; codebase is JS today
      'no-var': 'off',
      'prefer-const': ['warn', { destructuring: 'all' }],
      'no-console': 'off',
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }]
    }
  }
]
