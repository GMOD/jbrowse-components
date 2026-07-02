import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import { importX } from 'eslint-plugin-import-x'
import eslintPluginAstro from 'eslint-plugin-astro'
import eslintReact from '@eslint-react/eslint-plugin'
import reactCompiler from 'eslint-plugin-react-compiler'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import tssUnusedClasses from 'eslint-plugin-tss-unused-classes'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import baselineJs from 'eslint-plugin-baseline-js'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'

export default defineConfig(
  {
    ignores: [
      // Build outputs
      '**/build',
      '**/dist*',
      '**/esm',
      '**/public',
      '**/.astro',

      // Config and tooling
      'config/jest',
      'infrastructure',
      'jest.config.js',
      'products/jbrowse-web/browser-tests/memsticky.ts',
      'products/jbrowse-web/browser-tests/memprofile.ts',
      'babel.config.cjs',
      'eslint.config.mjs',
      'products/**/webpack.config.js',
      'products/**/webpack.config.mjs',
      '**/umd_plugin.js',

      'scripts/announce.mjs',
      'products/jbrowse-desktop/test/**',

      // Vendored/external code
      'packages/core/src/util/map-obj',
      'packages/core/src/util/nanoid.js',
      'packages/core/src/util/nanoid.ts',
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
      'products/**/examples-site/scripts',
      'products/jbrowse-img/src/bin.js',

      // jbrowse-img integration tests + their tsx loader hook run via node:test
      // (not jest/typed-lint); see products/jbrowse-img/CLAUDE.md
      'products/jbrowse-img/src/**/*.mjs',

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
      'products/*/examples-site/astro.config.mjs',
      // examples-site Astro apps are standalone demos excluded from the root
      // tsconfig; their TS frontmatter isn't parsed by the type-aware pipeline,
      // so lint them via their own tooling, not here.
      'products/*/examples-site/**/*.astro',
      'products/examples-site-shared/**/*.astro',
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
      globals: {
        ...globals.browser,
      },
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
  eslintReact.configs['recommended-typescript'],
  // eslint-plugin-unicorn: we adopt it as a DENYLIST, not an allowlist. The
  // `recommended` preset is the base (every recommended rule is ON), and the
  // block below explicitly turns OFF the ones we reject or are deferring. This
  // way, when a new unicorn version ships new rules, they light up on the next
  // lint/upgrade and force a conscious keep-or-disable decision instead of
  // being silently ignored. `// N` comments are the violation count at the time
  // of deferral — treat the "Deferred" section as a to-do list to burn down.
  eslintPluginUnicorn.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    rules: {
      // === Rejected outright ===
      // Abbreviation nannying — we use camelCase abbreviations freely.
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/name-replacements': 'off', // 6976 (err->error, e->event, etc.)
      // We mix PascalCase (React components) with camelCase; no single case.
      'unicorn/filename-case': 'off',
      // Don't dictate named vs namespace import style (e.g. `node:fs`).
      'unicorn/import-style': 'off',

      // === Opinionated / high-churn, intentionally not adopted ===
      'unicorn/no-null': 'off', // 1035 — null is intentional in JSON/DOM/MST
      'unicorn/consistent-boolean-name': 'off', // 811 — would rename serialized config-slot/prop names
      'unicorn/numeric-separators-style': 'off', // 2051 — purely cosmetic churn
      'unicorn/no-this-outside-of-class': 'off', // 351 — conflicts with MST `self` patterns

      // Conflicts with baseline-js `available: 'widely'`: Uint8Array
      // toBase64()/fromBase64() aren't widely-available baseline yet.
      'unicorn/prefer-uint8array-base64': 'off',

      // === Conflicts with repo conventions (nest / ternaries over early return) ===
      'unicorn/prefer-early-return': 'off', // 74 — we prefer nesting over early return
      'unicorn/no-useless-else': 'off', // 93 — pushes early-return de-nesting
      'unicorn/no-lonely-if': 'off', // 6 — nesting preference
      'unicorn/no-negated-condition': 'off', // 180
      'unicorn/no-nested-ternary': 'off', // 166 — nested ternaries are fine here

      // === Deferred: valid rules not adopted in this first pass. Enable
      // incrementally; the number is the violation count at deferral time. ===
      'unicorn/number-literal-case': 'off', // 618
      'unicorn/prefer-global-this': 'off', // 253
      'unicorn/catch-error-name': 'off', // 246
      'unicorn/prefer-await': 'off', // 233
      'unicorn/switch-case-braces': 'off', // 207
      'unicorn/no-useless-undefined': 'off', // 207
      'unicorn/no-useless-template-literals': 'off', // 161
      'unicorn/explicit-length-check': 'off', // 158
      'unicorn/prefer-code-point': 'off', // 134
      'unicorn/consistent-function-scoping': 'off', // 129
      'unicorn/max-nested-calls': 'off', // 114
      'unicorn/no-array-sort': 'off', // 113
      'unicorn/no-for-loop': 'off', // 96
      'unicorn/no-break-in-nested-loop': 'off', // 83
      'unicorn/prefer-spread': 'off', // 83
      'unicorn/consistent-conditional-object-spread': 'off', // 64
      'unicorn/prefer-iterator-to-array': 'off', // 57
      'unicorn/no-top-level-assignment-in-function': 'off', // 57
      'unicorn/no-computed-property-existence-check': 'off', // 55
      'unicorn/no-await-expression-member': 'off', // 55 — mostly NOT auto-fixable, churn is largely test files
      'unicorn/no-unsafe-property-key': 'off', // 4 — legacy dynamic string-key access; proper fix needs type-level work
      'unicorn/prefer-continue': 'off', // 53
      'unicorn/no-return-array-push': 'off', // 53
      'unicorn/prefer-number-coercion': 'off', // 53
      'unicorn/require-array-sort-compare': 'off', // 52
      'unicorn/consistent-class-member-order': 'off', // 52
      'unicorn/no-global-object-property-assignment': 'off', // 43
      'unicorn/prefer-switch': 'off', // 41
      'unicorn/prefer-global-number-constants': 'off', // 41
      'unicorn/no-array-callback-reference': 'off', // 37
      'unicorn/no-declarations-before-early-exit': 'off', // 31
      'unicorn/consistent-compound-words': 'off', // 28
      'unicorn/no-new-array': 'off', // 27
      'unicorn/no-unreadable-for-of-expression': 'off', // 25
      'unicorn/prefer-at': 'off', // 23
      'unicorn/prefer-math-trunc': 'off', // 23
      'unicorn/prefer-includes-over-repeated-comparisons': 'off', // 22
      'unicorn/no-top-level-side-effects': 'off', // 22
      'unicorn/no-non-function-verb-prefix': 'off', // 21
      'unicorn/better-dom-traversing': 'off', // 21
      'unicorn/operator-assignment': 'off', // 18
      'unicorn/isolated-functions': 'off', // 16
      'unicorn/no-process-exit': 'off', // 15
      'unicorn/prefer-direct-iteration': 'off', // 14
      'unicorn/prefer-optional-catch-binding': 'off', // 13
      'unicorn/prefer-export-from': 'off', // 13
      'unicorn/no-unreadable-array-destructuring': 'off', // 12
      'unicorn/prefer-add-event-listener': 'off', // 12
      'unicorn/prefer-minimal-ternary': 'off', // 12
      'unicorn/prefer-number-is-safe-integer': 'off', // 12
      'unicorn/logical-assignment-operators': 'off', // 11
      'unicorn/no-array-reverse': 'off', // 11
      'unicorn/no-useless-coercion': 'off', // 10
      'unicorn/prefer-module': 'off', // 10
      'unicorn/prefer-type-error': 'off', // 9
      'unicorn/prefer-object-iterable-methods': 'off', // 9
      'unicorn/no-for-each': 'off', // 9
      'unicorn/prefer-ternary': 'off', // 8
      'unicorn/prefer-add-event-listener-options': 'off', // 8
      'unicorn/text-encoding-identifier-case': 'off', // 8
      'unicorn/prefer-top-level-await': 'off', // 8
      'unicorn/no-negated-array-predicate': 'off', // 7
      'unicorn/no-unsafe-string-replacement': 'off', // 7
      'unicorn/prefer-boolean-return': 'off', // 6
      'unicorn/prefer-array-from-map': 'off', // 6
      'unicorn/prefer-promise-with-resolvers': 'off', // 6
      'unicorn/prefer-else-if': 'off', // 6
      'unicorn/prefer-response-static-json': 'off', // 6
      'unicorn/prefer-string-raw': 'off', // 6
      'unicorn/prefer-split-limit': 'off', // 5
      'unicorn/prefer-set-methods': 'off', // 5
      'unicorn/no-subtraction-comparison': 'off', // 4
      'unicorn/prefer-logical-operator-over-ternary': 'off', // 4
      'unicorn/prefer-single-call': 'off', // 4
      'unicorn/prefer-iterator-helpers': 'off', // 4
      'unicorn/prefer-hoisting-branch-code': 'off', // 4
      'unicorn/prefer-https': 'off', // 4
      'unicorn/relative-url-style': 'off', // 4
      'unicorn/no-negated-comparison': 'off', // 3
      'unicorn/no-abusive-eslint-disable': 'off', // 3
      'unicorn/prefer-query-selector': 'off', // 3
      'unicorn/no-array-reduce': 'off', // 3
      'unicorn/consistent-json-file-read': 'off', // 3
      'unicorn/no-object-as-default-parameter': 'off', // 3
      'unicorn/consistent-existence-index-check': 'off', // 3
      'unicorn/no-unnecessary-global-this': 'off', // 2
      'unicorn/prefer-unary-minus': 'off', // 2
      'unicorn/prefer-structured-clone': 'off', // 2
      'unicorn/prefer-smaller-scope': 'off', // 2
      'unicorn/no-unnecessary-array-flat-map': 'off', // 2
      'unicorn/prefer-url-href': 'off', // 2
      'unicorn/prefer-blob-reading-methods': 'off', // 2
      'unicorn/no-empty-file': 'off', // 1
      'unicorn/prefer-dom-node-text-content': 'off', // 1
      'unicorn/prefer-string-repeat': 'off', // 1
      'unicorn/class-reference-in-static-methods': 'off', // 1
      'unicorn/prefer-has-check': 'off', // 1
      'unicorn/prefer-string-slice': 'off', // 1
      'unicorn/prefer-unicode-code-point-escapes': 'off', // 1
      'unicorn/no-unnecessary-fetch-options': 'off', // 1
      'unicorn/no-late-current-target-access': 'off', // 1
      'unicorn/no-useless-recursion': 'off', // 1
      'unicorn/no-useless-override': 'off', // 1
      'unicorn/prefer-array-find': 'off', // 1
      'unicorn/prefer-observer-apis': 'off', // 1
      'unicorn/prefer-type-literal-last': 'off', // 1
      'unicorn/default-export-style': 'off', // 1
      'unicorn/no-error-property-assignment': 'off', // 1
      'unicorn/prefer-promise-try': 'off', // 1
      'unicorn/prefer-math-min-max': 'off', // 1
      'unicorn/no-useless-collection-argument': 'off', // 1
      'unicorn/no-exports-in-scripts': 'off', // 1
      'unicorn/prefer-native-coercion-functions': 'off', // 1
      'unicorn/no-useless-continue': 'off', // 1
      'unicorn/template-indent': 'off', // 1
      'unicorn/prefer-iterable-in-constructor': 'off', // 1
      'unicorn/prefer-location-assign': 'off', // 1
    },
  },
  {
    files: ['**/*.{js,ts,jsx,tsx}'],
    plugins: {
      'baseline-js': baselineJs,
    },
    rules: {
      'baseline-js/use-baseline': [
        'error',
        {
          available: 'widely',
        },
      ],
    },
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
      // Vite resource queries (`?raw`, `?url`, etc.) make an import resolve to
      // different content than the bare path; without this, no-duplicates
      // treats e.g. `from './x.tsx'` + `from './x.tsx?raw'` as duplicates.
      'import-x/no-duplicates': ['error', { considerQueryString: true }],
      // Pluggable components (ReactComponent/HeadingComponent/etc.) are
      // resolved via pluginManager registry lookups (getViewType,
      // getWidgetType, evaluateExtensionPoint) and rendered as JSX. This rule
      // can't tell those calls return stable registered references, not
      // components defined during render, so it false-positives across the
      // whole plugin architecture.
      '@eslint-react/static-components': 'off',
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
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],
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
      'website/scripts/**/*',
      'products/jbrowse-img/**/*',
      'products/jbrowse-web/scripts/*',
      'products/jbrowse-cli/**/*',
      'products/jbrowse-desktop/sign.cjs',
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
      // Node-only build scripts/CLIs: baseline-js checks browser feature
      // availability, which is irrelevant here (top-level await etc. are fine).
      'baseline-js/use-baseline': 'off',
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
  // Incremental rollout of strict-boolean-expressions: we want conditions to be
  // explicit (no implicit coercion of nullable strings/numbers/booleans or
  // `any`). The rule is opt-in per-package as each is cleaned up; expand the
  // glob as more packages are made compliant. packages/sv-core is the first.
  {
    files: ['packages/sv-core/src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/strict-boolean-expressions': 'error',
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
  // Guards against regressions in the SVG-export pipeline. See
  // agent-docs/ARCHITECTURE.md "SVG export pipeline (single source of truth)".
  // Heavy draw paths must go through paintLayer; clipPath wrappers must use
  // SvgClipRect for consistency.
  // NOTE: must come after the global no-restricted-syntax block above so that
  // both selector sets apply to renderSvg.tsx (flat config overrides, not merges).
  {
    files: ['plugins/**/renderSvg.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='jest'][callee.property.name=/^(un)?mock$/] > Literal[value=/^@jbrowse\\/[^/]+\\/src(\\/.+)?$/]",
          message:
            'Do not mock from the src directory of another package. Use the package public API instead.',
        },
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
  // Each product's examples-site is a standalone Astro app excluded from the
  // root tsconfig, so type-aware linting must use its own tsconfig. These are
  // demonstrative examples, so `console.log` (e.g. logging a patch/region to
  // show how to observe state) is legitimate, not a leftover debug statement.
  {
    files: ['products/*/examples-site/src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['./products/*/examples-site/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'off',
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
  // The frontmatter of .astro files isn't part of any tsconfig `include`, so
  // type-aware linting (which needs `parserOptions.project`) can't work
  // there. Must come last so it wins over the blanket rule blocks above that
  // re-enable type-checked rules with no `files` restriction.
  {
    files: ['**/*.astro', '**/*.astro/*.js', '**/*.astro/*.ts'],
    languageOptions: {
      parserOptions: {
        // astro-eslint-parser needs the TS parser to read TypeScript
        // frontmatter (interface/`!`/etc.); the astro recommended preset
        // doesn't set this, so frontmatter would otherwise parse as plain JS.
        parser: tseslint.parser,
        project: null,
      },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      // consistent-type-imports/exports need type information but aren't part
      // of tseslint's disableTypeChecked set, so with `project: null` above
      // they throw ("rule requires type information") and abort the whole lint
      // run on any .astro file. Turn them off here explicitly.
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/consistent-type-exports': 'off',
      // Astro injects client-script variables via `<script define:vars={{…}}>`,
      // which ESLint's scope analysis can't see, so no-undef false-positives on
      // them. TypeScript/astro handle real undefined-variable checks.
      'no-undef': 'off',
      // `{list.map(x => <div>)}` in an .astro template compiles to static
      // HTML, not a React reconciliation tree, so there's no virtual-DOM key
      // to provide — this rule only makes sense for actual React JSX.
      '@eslint-react/no-missing-key': 'off',
    },
  },
)
