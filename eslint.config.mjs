import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import importPlugin from 'eslint-plugin-import'
import eslintPluginReact from 'eslint-plugin-react'
import reactCompiler from 'eslint-plugin-react-compiler'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import tssUnusedClasses from 'eslint-plugin-tss-unused-classes'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    ignores: [
      'packages/__mocks__/@testing-library/react.tsx',
      'packages/__mocks__/@jbrowse/core/ui/SanitizedHTML.tsx',
      'packages/__mocks__/generic-filehandle2.ts',
      'packages/core/util/map-obj/*',
      'scripts/analyze_cpuprof.ts',
      'config/jest/*',
      'benchmarks/*',
      '**/build/**/*',
      '**/dist/**/*',
      'scripts/analyze_cpuprof.ts',
      '**/esm/**/*',
      '**/public/**/*',
      '**/storybook-static/**',
      'products/jbrowse-desktop/linux-sandbox-fix.cjs',
      'docs/*',
      'website/*',
      'plugins/variants/src/d3-hierarchy2',
      'packages/core/util/nanoid.js',
      'packages/core/util/flatbush/index.js',
      'products/**/webpack.config.js',
      'products/jbrowse-desktop/scripts/*',
      'plugin-development-tools/**',
      'products/jbrowse-cli/lib/**',
      'products/jbrowse-cli/bundle/**',
      'auth_test_utils/**/*',
      'component_tests/**/*',
      'packages/core/util/map-obj.ts',
      'embedded_demos/**/*',
      '**/output-version.js',
      '**/.storybook/*',
      '**/umd_plugin.js',
    ],
  },
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },

    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    plugins: {
      'react-compiler': reactCompiler,
      'tss-unused-classes': tssUnusedClasses,
    },
    rules: {
      'react-compiler/react-compiler': 'error',
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylisticTypeChecked,
  ...tseslint.configs.strictTypeChecked,
  importPlugin.flatConfigs.recommended,
  eslintPluginReact.configs.flat.recommended,
  {
    plugins: {
      'react-hooks': eslintPluginReactHooks,
    },
    rules: eslintPluginReactHooks.configs.recommended.rules,
  },
  eslintPluginUnicorn.configs.recommended,
  {
    // in main config for TSX/JSX source files
    plugins: {
      'react-refresh': eslintPluginReactRefresh,
    },
    rules: {},
  },
  {
    rules: {
      'no-restricted-globals': ['error', 'Buffer'],
      'no-empty': 'off',
      'no-console': [
        'error',
        {
          allow: ['error', 'warn'],
        },
      ],
      'tss-unused-classes/unused-classes': 'warn',
      'no-underscore-dangle': 'off',
      curly: 'error',
      semi: ['error', 'never'],
      'spaced-comment': [
        'error',
        'always',
        {
          markers: ['/'],
        },
      ],

      'prefer-template': 'error',
      'one-var': ['error', 'never'],
      'react-refresh/only-export-components': 'error',
      'react/no-unescaped-entities': 'off',
      'react/no-is-mounted': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      'unicorn/prefer-response-static-json': 'off',
      'unicorn/text-encoding-identifier-case': 'off',
      'unicorn/prefer-global-this': 'off',
      'unicorn/prefer-structured-clone': 'off',
      'unicorn/no-new-array': 'off',
      'unicorn/no-empty-file': 'off',
      'unicorn/prefer-type-error': 'off',
      'unicorn/prefer-modern-math-apis': 'off',
      'unicorn/prefer-node-protocol': 'off',
      'unicorn/no-unreadable-array-destructuring': 'off',
      'unicorn/no-abusive-eslint-disable': 'off',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/number-literal-case': 'off',
      'unicorn/prefer-add-event-listener': 'off',
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'unicorn/no-await-expression-member': 'off',
      'unicorn/no-lonely-if': 'off',
      'unicorn/consistent-destructuring': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/prefer-optional-catch-binding': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-nested-ternary': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/catch-error-name': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/prefer-code-point': 'off',
      'unicorn/numeric-separators-style': 'off',
      'unicorn/prefer-spread': 'off',
      'unicorn/explicit-length-check': 'off',
      'unicorn/prefer-regexp-test': 'off',
      'unicorn/relative-url-style': 'off',
      'unicorn/prefer-math-trunc': 'off',
      'unicorn/prefer-query-selector': 'off',
      'unicorn/no-negated-condition': 'off',
      'unicorn/switch-case-braces': 'off',
      'unicorn/prefer-switch': 'off',
      'unicorn/better-regex': 'off',
      'unicorn/escape-case': 'off',
      'unicorn/prefer-number-properties': 'off',
      'unicorn/no-array-reverse': 'off',
      'unicorn/no-process-exit': 'off',
      'unicorn/prefer-at': 'off',
      'unicorn/prefer-string-replace-all': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/expiring-todo-comments': 'off',
      'unicorn/no-array-sort': 'off',

      'import/no-unresolved': 'off',
      'import/order': [
        'error',
        {
          named: true,
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
          },
          groups: [
            'builtin',
            ['external', 'internal'],
            ['parent', 'sibling', 'index', 'object'],
            'type',
          ],
          pathGroups: [
            {
              group: 'builtin',
              pattern: 'react',
              position: 'before',
            },
            {
              group: 'external',
              pattern: '@mui/icons-material',
              position: 'after',
            },
          ],

          pathGroupsExcludedImportTypes: ['react'],
        },
      ],

      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unnecessary-type-conversion': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          caughtErrors: 'none',
        },
      ],
    },
  },
  {
    files: [
      'babel.config.js',
      'jest.config.js',
      'webpack/**/*',
      'scripts/**/*',
      'products/jbrowse-cli/**/*',
      'products/jbrowse-img/**/*',
      'products/jbrowse-web/scripts/*',
      'products/jbrowse-desktop/scripts/*',
      'products/jbrowse-desktop/sign.cjs',
      'products/jbrowse-aws-lambda-functions/**/*.js',
      'plugins/data-management/scripts/*.js',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-restricted-globals': ['off'],
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['config/jest/*.js', 'integration.test.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['**/workerPolyfill.js'],
    languageOptions: {
      globals: {
        ...globals.worker,
      },
    },
  },
)
