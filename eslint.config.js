import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'public/dict/**', '.playwright-mcp/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    // Scripts de Node y configs: no tienen los globals del navegador.
    files: ['scripts/**/*.mjs', '*.config.js', 'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', URL: 'readonly', __dirname: 'readonly' },
    },
  },
  {
    rules: {
      // Los argumentos/variables con prefijo `_` son deliberadamente no usados.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
);
