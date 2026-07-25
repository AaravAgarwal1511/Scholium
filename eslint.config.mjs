import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Root config, for the TypeScript that lives outside any workspace package —
// currently just the database security suite. Every app and package has its own
// eslint.config.js, and ESLint resolves the nearest one from the working
// directory, so `eslint .` inside a package never reaches this file.
//
// Run via `pnpm lint:db`, which scopes it to database/ rather than the repo root.
export default defineConfig([
  // The schema snapshot is generated Supabase output, not hand-written code.
  globalIgnores([
    '**/node_modules',
    '**/dist',
    'apps',
    'packages',
    'admin',
    'database/schema-types.snapshot.ts',
  ]),
  {
    files: ['database/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      // These run in Node (vitest's node environment), not a browser.
      globals: globals.node,
    },
  },
])
