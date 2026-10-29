import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'release/**', 'node_modules/**', '.claude/**', 'graphify-out/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'tests/**/*.{ts,mjs}', 'scripts/**/*.mjs', '*.config.{ts,mjs}'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    rules: {
      // Renderers are sandboxed: anything privileged goes through window.assistant.
      'no-restricted-imports': ['error', { patterns: ['node:*', 'electron', 'fs', 'child_process', 'path'] }]
    }
  }
)
