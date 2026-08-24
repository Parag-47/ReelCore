/* eslint-disable n/no-unpublished-import */
import js from "@eslint/js";
import globals from "globals";

import importX from "eslint-plugin-import-x";
import pluginN from "eslint-plugin-n";
import pluginPromise from "eslint-plugin-promise";
import pluginSecurity from "eslint-plugin-security";
import sonarjs from "eslint-plugin-sonarjs";
// import unicorn from "eslint-plugin-unicorn";

import prettier from "eslint-config-prettier";

export default [
  // Ignore generated files
  {
    ignores: ["node_modules/**", "coverage/**", "dist/**", "build/**"],
  },

  // ESLint core rules
  js.configs.recommended,

  // Plugin recommended configs
  importX.flatConfigs.recommended,
  pluginN.configs["flat/recommended"],
  pluginPromise.configs["flat/recommended"],
  pluginSecurity.configs.recommended,
  sonarjs.configs.recommended,
  // unicorn.configs["flat/recommended"],

  {
    files: ["**/*.js"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",

      globals: {
        ...globals.node,
      },
    },

    rules: {
      // Project-specific overrides
      "no-console": "off",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      "require-await": "off",

      "no-throw-literal": "error",

      // SonarJS
      "sonarjs/no-unused-vars": "off",
      "sonarjs/todo-tag": "warn",

      // Unicorn tweaks
      // "unicorn/prevent-abbreviations": "off",
      // "unicorn/filename-case": "off",
      // "unicorn/no-null": "off",
      // "unicorn/prefer-top-level-await": "off",
      // "unicorn/name-replacements": "off",
      // "unicorn/default-export-style": ["error", { functions: "ignore" }],

      // Security
      "security/detect-object-injection": "off",
    },
  },

  prettier,
];
