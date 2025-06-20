import js from '@eslint/js';
import { default as typescriptEslint } from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import securityPlugin from 'eslint-plugin-security';
import globals from 'globals';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const tsconfigPaths = [
  './libraries/tsconfig/tsconfig.json',
  './apps/aadvantage/tsconfig.json',
  './apps/aeromexico-rewards/tsconfig.json',
  './apps/mileage-plan/tsconfig.json',
  './apps/etihad-guest/tsconfig.json',
  './apps/flying-club/tsconfig.json',
  './apps/miles-and-smiles/tsconfig.json',
  './apps/trueblue/tsconfig.json',
  './apps/skymiles/tsconfig.json',
  './libraries/configuration-provider/tsconfig.json',
  './libraries/error-handling/tsconfig.json',
  './libraries/esbuild-plugin-pino/tsconfig.json',
  './libraries/logger/tsconfig.json',
  './libraries/shared-utils/tsconfig.json',
  './libraries/request-context/tsconfig.json',
  './libraries/secure-headers/tsconfig.json',
].map((path) => resolve(__dirname, path));

export default [
  {
    ignores: [
      '**/.dist/*',
      '**/node_modules/*',
      '**/.eslintrc.js',
      '**/build.js',
      '**/build.ts',
      '**/build-lib.ts',
      '.prettierrc.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': typescriptEslint,
      prettier,
      security: securityPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parser: tsParser,
      parserOptions: {
        project: tsconfigPaths,
      },
    },
    rules: {
      'prettier/prettier': 'error',
      'no-console': [
        'error',
        {
          allow: ['time', 'timeEnd'],
        },
      ],
      'no-return-await': 'off',
      '@typescript-eslint/no-shadow': ['error'],
      '@typescript-eslint/no-unsafe-assignment': ['error'],
      '@typescript-eslint/no-unsafe-argument': ['error'],
      '@typescript-eslint/no-unsafe-call': ['error'],
      '@typescript-eslint/no-unsafe-member-access': ['error'],
      ...typescriptEslint.configs['eslint-recommended'].rules,
      ...typescriptEslint.configs.recommended.rules,
      ...securityPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];
