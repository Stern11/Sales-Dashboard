// Flat config (ESLint 9). Three runtimes live in this repo and they don't
// share globals, so each gets its own block rather than one permissive
// union that would let a `document` reference into a serverless function:
//
//   src/         — browser (React)
//   api/, lib/,
//   scripts/     — Node
//   middleware.js — Vercel Edge (Web-standard globals only, no Node builtins)
//
// Deliberately close to the code that already exists: the goal is to catch
// the classes of bug this codebase actually has (missing hook deps, unused
// bindings, accidental globals), not to relitigate style. There is no
// formatter here on purpose — no Prettier, no stylistic rules — so this
// never fights hand-tuned formatting in a diff.

import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

const noUnusedVars = [
  "error",
  {
    // Matches the existing convention of naming a deliberately-unused
    // binding with a leading underscore.
    argsIgnorePattern: "^_",
    varsIgnorePattern: "^_",
    caughtErrors: "all",
    caughtErrorsIgnorePattern: "^_",
  },
];

export default [
  {
    ignores: ["dist/**", "node_modules/**", ".vercel/**"],
  },

  // Browser / React.
  {
    files: ["src/**/*.{js,jsx}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // Without these two, plain `no-unused-vars` can't see that a component
      // imported for JSX is used — it reports every one of them as dead.
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",

      "no-unused-vars": noUnusedVars,

      // eslint-plugin-react-hooks@7 folds the React Compiler rule suite into
      // its `recommended` set. Those rules describe a stricter React than
      // this app is written in, and turning them on as errors would mean
      // rewriting working code to satisfy a linter rather than to fix a bug.
      // Kept as warnings: visible when you look, never a red build. The two
      // rules that catch actual defects — rules-of-hooks and exhaustive-deps
      // — stay at error, which is the reason this plugin is here at all.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },

  // Node: serverless functions, shared server code, the migration runner.
  {
    files: ["api/**/*.js", "lib/**/*.js", "scripts/**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": noUnusedVars,
    },
  },

  // Vercel Edge Middleware: Web-standard globals only. `process` is the one
  // Node-ism Vercel does expose there (for env vars), so it's added by hand
  // rather than pulling in all of globals.node — which would wrongly allow
  // Buffer/fs/etc. that genuinely aren't available in that runtime.
  {
    files: ["middleware.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, process: "readonly" },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": noUnusedVars,
    },
  },

  // Tests: Node plus vitest's injected globals-by-import (they're imported
  // explicitly in this suite, so only the environment differs).
  {
    files: ["test/**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": noUnusedVars,
    },
  },
];
