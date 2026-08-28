import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// DOM/browser-only globals that must never appear in src/core/** — the RL
// domain layer (Environment/Agent/Algorithm/SimulationEngine) has to run
// identically in a browser tab and in a headless Vitest/Node process.
const domGlobals = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'alert',
  'confirm',
  'prompt',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'HTMLElement',
  'Element',
  'Node',
]

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Architecture rule (ARCHITECTURE.md §10): src/core/** must not depend on
    // React or the DOM, so RL logic stays framework-agnostic and unit
    // testable in plain Node.
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
              message:
                'src/core/** must not depend on React (ARCHITECTURE.md: RL logic stays UI-independent).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...domGlobals.map((name) => ({
          name,
          message:
            'src/core/** must not depend on DOM globals (ARCHITECTURE.md: RL logic stays UI-independent).',
        })),
      ],
    },
  },
)
