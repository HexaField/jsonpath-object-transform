// ESLint Flat Config
import js from '@eslint/js';
import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  { ignores: ['node_modules/**', 'example/**', 'run_template.js', 'dist/**', 'dist-example/**'] },
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      parser: tsparser,
      parserOptions: { project: ['./tsconfig.json'] },
      globals: { ...globals.node, define: 'readonly' }
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      'no-var': 'off',
      'prefer-const': ['warn', { destructuring: 'all' }],
      'no-console': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }]
    }
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: { ...globals.node, define: 'readonly' }
    },
    rules: {
      'no-var': 'off',
      'prefer-const': ['warn', { destructuring: 'all' }],
      'no-console': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off'
    }
  },
  { files: ['lib/**/*.js'], rules: { 'no-redeclare': 'off', 'no-useless-escape': 'off' } },
  { files: ['test/**/*.js'], languageOptions: { globals: { ...globals.mocha } } }
];
