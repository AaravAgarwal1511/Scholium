// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([globalIgnores(['dist']), {
  files: ['**/*.{ts,tsx}'],
  extends: [
    js.configs.recommended,
    tseslint.configs.recommended,
    // react-hooks 5.x exposes its flat config at configs['recommended-latest'];
    // 7.x moved it to configs.flat.recommended.
    reactHooks.configs.flat?.recommended ?? reactHooks.configs['recommended-latest'],
    reactRefresh.configs.vite,
  ],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  rules: {
    // A leading underscore is how this codebase marks an argument that exists to
    // document a signature but is deliberately unused (see src/__mocks__).
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
}, ...storybook.configs["flat/recommended"]])
