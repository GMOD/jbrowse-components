import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import { importX } from 'eslint-plugin-import-x'
import eslintPluginReact from 'eslint-plugin-react'
import reactCompiler from 'eslint-plugin-react-compiler'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import tssUnusedClasses from 'eslint-plugin-tss-unused-classes'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import baselineJs from 'eslint-plugin-baseline-js'

export default defineConfig(
  {
    ignores: [
      // Build outputs
      '**/build',
      '**/dist*',
      '**/esm',
      '**/public',
      '**/storybook-static',

      // Config and tooling
      'config/jest',
      'jest.config.js',
      'babel.config.cjs',
      'eslint.config.mjs',
      'products/**/webpack.config.js',
      'products/**/webpack.config.mjs',
      '**/.storybook',
      '**/umd_plugin.js',

      'products/jbrowse-desktop/test/e2e.ts',

      // Vendored/external code
      'packages/core/src/util/map-obj',
      'packages/core/src/util/nanoid.js',
      'packages/core/src/ReExports/material-ui-colors.js',
      'packages/tree-sidebar/src/d3-hierarchy2',
      'plugins/variants/src/d3-hierarchy2',
      'plugins/wiggle/src/d3-hierarchy2',
      'plugins/alignments/src/CramAdapter/testNA12878.mjs',

      // Desktop tests
      'products/jbrowse-desktop/test/specs/test.e2e.ts',
      'products/jbrowse-desktop/wdio.conf.ts',

      // Scripts
      'scripts/analyze_cpuprof.ts',
      'scripts/getSuggestions.js',
      'scripts/ribbon-plot-pif.mjs',
      'scripts/ribbon-plot.mjs',
      'scripts/verify-hs1-mm39-dotplot.mjs',
      'scripts/verify-hs1-mm39.mjs',
      'packages/core/scripts/generateExports.mjs',
      'plugins/data-management/scripts',
      'products/jbrowse-desktop/scripts',
      'products/jbrowse-desktop/linux-sandbox-fix.cjs',
      'products/jbrowse-desktop/linux-sandbox-fix.js',
      'products/jbrowse-desktop/sign.js',
      'products/jbrowse-web/scripts',
      'products/jbrowse-img/src/bin.js',

      'packages/core/src/util/p-limit.ts',

      // AWS Lambda functions
      'products/jbrowse-aws-lambda-functions',

      // Test fixtures and mocks
      '**/test_data',
      'test/data',
      'packages/__mocks__',
      'integration.test.js',

      // Excluded directories
      'webpack',
      'website/blog',
      'website/docs',
      'website/static',

      'website/.astro',
      'website/.prettierrc.mjs',
      'website/astro.config.mjs',
      'docs',
      'benchmarks',
      'auth_test_utils',
      'component_tests',
      'embedded_demos',
      'plugin-development-tools',
      'products/jbrowse-cli/lib',
      'products/jbrowse-cli/bundle',
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
        version: '19.2.4',
      },
      'import-x/resolver': {
        typescript: true,
        node: true,
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
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  eslintPluginReact.configs.flat.recommended,
  {
    files: ['**/*.{js,ts,jsx,tsx}'],
    plugins: { 'baseline-js': baselineJs },
    rules: {
      'baseline-js/use-baseline': ['error', { available: 'widely' }],
    },
  },
  {
    plugins: {
      'react-hooks': eslintPluginReactHooks,
    },
    rules: eslintPluginReactHooks.configs.recommended.rules,
  },
  {
    plugins: {
      'react-refresh': eslintPluginReactRefresh,
    },
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
      //complexity: ['warn', 15],
      curly: 'error',
      'object-shorthand': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
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

      'import-x/no-unresolved': 'off',
      'import-x/order': [
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

      'import-x/extensions': ['error', 'ignorePackages'],
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',
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
      'webpack/**/*',
      'scripts/**/*',
      'products/jbrowse-img/**/*',
      'products/jbrowse-web/scripts/*',
      'products/jbrowse-cli/**/*',
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
      'no-restricted-globals': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
      'no-console': 'off',
      'no-undef': 'off',
    },
  },
  {
    // Electron main process: separate tsconfig, runs in node, uses console.log
    // for auto-updater status messages.
    files: ['products/jbrowse-desktop/electron/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        project: ['./products/jbrowse-desktop/electron/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'off',
      // IpcChannels descriptors use `return: void` to mean "resolves to
      // nothing"; switching to `undefined` breaks handler assignability.
      '@typescript-eslint/no-invalid-void-type': 'off',
    },
  },
  {
    files: ['integration.test.js'],
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
    files: ['products/jbrowse-web/webgpu-debug.mjs'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  // Guards against regressions in the SVG-export pipeline. See
  // agent-docs/ARCHITECTURE.md "SVG export pipeline (single source of truth)".
  // Heavy draw paths must go through paintLayer; clipPath wrappers must use
  // SvgClipRect for consistency.
  {
    files: ['plugins/**/renderSvg.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='SvgCanvas']",
          message:
            'Use paintLayer(width, height, opts, ctx => drawXxxToCtx(ctx, …)) instead of constructing SvgCanvas directly. See agent-docs/ARCHITECTURE.md "SVG export pipeline".',
        },
        {
          selector: "JSXOpeningElement[name.name='clipPath']",
          message:
            'Use <SvgClipRect> from @jbrowse/plugin-linear-genome-view instead of hand-rolling <defs><clipPath><rect>. See agent-docs/ARCHITECTURE.md "SVG export pipeline".',
        },
      ],
    },
  },
  // Catch jest.mock/unmock calls that reach into another package's src/.
  // no-restricted-imports only covers import statements, not call expressions.
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='jest'][callee.property.name=/^(un)?mock$/] > Literal[value=/^@jbrowse\\/[^/]+\\/src(\\/.+)?$/]",
          message:
            'Do not mock from the src directory of another package. Use the package public API instead.',
        },
      ],
    },
  },
  // website/src + website/scripts — use website/tsconfig.json (not root).
  {
    files: ['website/src/**/*.{ts,tsx}', 'website/scripts/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./website/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Plain .ts files in website/src + website/scripts have no React
  // components, so React rules are disabled.
  {
    files: ['website/src/**/*.ts', 'website/scripts/**/*.ts'],
    rules: {
      'react-compiler/react-compiler': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  // useEffectEvent returns a stale closure inside mobx-react observer()
  // components (its useInsertionEffect impl-swap does not run under observer's
  // reactive render), and nearly every JBrowse component is an observer. Use
  // useEventCallback instead. See key_pattern_useeffectevent_observer_hazard.
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              importNames: ['useEffectEvent'],
              message:
                'useEffectEvent reads stale state inside mobx-react observer() components. Use useEventCallback from @jbrowse/core/util/useEventCallback instead.',
            },
          ],
          patterns: [
            {
              group: ['@jbrowse/*/src', '@jbrowse/*/src/**'],
              message:
                'Do not import from the src directory of another package. Use the package public API instead.',
            },
          ],
        },
      ],
    },
  },
)
