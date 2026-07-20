import eslintReact from '@eslint-react/eslint-plugin'
import eslintPluginAstro from 'eslint-plugin-astro'
import { importX } from 'eslint-plugin-import-x'
import reactCompiler from 'eslint-plugin-react-compiler'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// CI-only backstop (`pnpm lint:eslint`). The primary linter is oxlint
// (`pnpm lint:fast` untyped / `pnpm lint` type-aware), which owns correctness,
// react-hooks, the full type-aware
// rule set (via tsgolint), and the portable core rules. Prettier owns
// formatting + import ordering. This config runs ONLY the rules oxlint can't
// yet do, and deliberately carries NO type information (no
// `parserOptions.project`) so it stays fast and needs only one TypeScript
// version — the things it enforces (react-compiler, the unicorn denylist,
// @eslint-react, react-refresh, the no-restricted-syntax guards, astro) are all
// syntactic. See agent-docs and .oxlintrc.json for the division of labor.
import oxlintConfig from './.oxlintrc.json' with { type: 'json' }

// Shared no-restricted-syntax selectors. Flat config *overrides* (not merges)
// the rule when a later block re-declares it, so any block that needs its own
// extra selectors must re-list these. Keep them here so the message text can't
// drift between copies.
const noMockFromSrc = {
  selector:
    "CallExpression[callee.object.name='jest'][callee.property.name=/^(un)?mock$/] > Literal[value=/^@jbrowse\\/[^/]+\\/src(\\/.+)?$/]",
  message:
    'Do not mock from the src directory of another package. Use the package public API instead.',
}
const noReadableFromWeb = {
  selector:
    "CallExpression[callee.object.name='Readable'][callee.property.name='fromWeb']",
  message:
    "Do not use Readable.fromWeb on a fetch body. In renderer/worker code the global fetch returns Chromium's DOM ReadableStream, a different realm than node:stream/web, and fromWeb's instanceof check throws the misleading 'must be an instance of ReadableStream. Received an instance of ReadableStream'. Drive body.getReader() into a node Readable instead (see packages/text-indexing-core webStreamToNodeReadable).",
}

export default defineConfig(
  {
    ignores: oxlintConfig.ignorePatterns,
  },
  {
    // The tree has ~84 inline `eslint-disable @typescript-eslint/*` comments
    // for rules that now run in oxlint (which honors the same comments). ESLint
    // no longer defines those rules, so it would report every one as an unused
    // directive. Turn the check off here — this is a thin CI backstop, not the
    // primary linter. Re-enable once the comments are migrated to
    // `oxlint-disable`.
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  {
    languageOptions: {
      // No `project` on purpose — this config is type-information-free so it
      // stays fast. tseslint.parser is still needed to parse TS/TSX syntax.
      parser: tseslint.parser,
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: {
        version: '19.2.4',
      },
    },
  },
  {
    plugins: {
      'react-compiler': reactCompiler,
      'react-refresh': eslintPluginReactRefresh,
      'import-x': importX,
      // Registered (rules left off) purely so the ~84 inline
      // `eslint-disable @typescript-eslint/*` comments in the tree still
      // resolve to a known rule instead of erroring "definition not found".
      // Those rules now run in oxlint (which honors the same disable comments);
      // this keeps the backstop green until the comments are migrated to
      // `oxlint-disable`.
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'react-compiler/react-compiler': 'error',
    },
  },
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
      'unicorn/prefer-dom-node-html-methods': 'off',
      // We mix PascalCase (React components) with camelCase; no single case.
      'unicorn/filename-case': 'off',
      'unicorn/prefer-simple-condition-first': 'off',
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
      // HIGH-VALUE bug-catcher: bare .sort() sorts numbers lexicographically
      // (1,10,2). Priority burndown — needs a per-site comparator each, not
      // auto-fixable, and string-sort sites may move snapshots.
      'unicorn/require-array-sort-compare': 'off', // 81
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
      'unicorn/no-unsafe-string-replacement': 'off', // 12 — real correctness (non-literal replacement can hit $&/$1 specials)
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
    rules: {
      // Core rules oxlint doesn't own for us and prettier doesn't cover.
      'no-console': ['error', { allow: ['error', 'warn'] }],
      curly: 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'one-var': ['error', 'never'],
      'spaced-comment': ['error', 'always', { markers: ['/'] }],
      'react-refresh/only-export-components': 'error',
      // Pluggable components (ReactComponent/HeadingComponent/etc.) are
      // resolved via pluginManager registry lookups (getViewType,
      // getWidgetType, evaluateExtensionPoint) and rendered as JSX. This rule
      // can't tell those calls return stable registered references, not
      // components defined during render, so it false-positives across the
      // whole plugin architecture.
      '@eslint-react/static-components': 'off',
      // Vite resource queries (`?raw`, `?url`, etc.) make an import resolve to
      // different content than the bare path; without this, no-duplicates
      // treats e.g. `from './x.tsx'` + `from './x.tsx?raw'` as duplicates.
      'import-x/no-duplicates': ['error', { considerQueryString: true }],
      'import-x/extensions': ['error', 'ignorePackages'],
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
      'no-console': 'off',
    },
  },
  {
    // Electron main process runs in node and uses console.log for auto-updater
    // status messages.
    files: ['products/jbrowse-desktop/electron/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
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
  // Catch jest.mock/unmock calls that reach into another package's src/.
  // no-restricted-imports only covers import statements, not call expressions.
  {
    rules: {
      'no-restricted-syntax': ['error', noMockFromSrc, noReadableFromWeb],
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
        noMockFromSrc,
        noReadableFromWeb,
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
  // Plain .ts files in website/src + website/scripts have no React
  // components, so React rules are disabled.
  {
    files: ['website/src/**/*.ts', 'website/scripts/**/*.ts'],
    rules: {
      'react-compiler/react-compiler': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  // Each product's examples-site is demonstrative, so `console.log` (e.g.
  // logging a patch/region to show how to observe state) is legitimate.
  {
    files: ['products/*/examples-site/src/**/*.{ts,tsx}'],
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
  // The frontmatter of .astro files needs the TS parser to read TypeScript
  // (interface/`!`/etc.); the astro recommended preset doesn't set this, so
  // frontmatter would otherwise parse as plain JS. Must come last so it wins.
  {
    files: ['**/*.astro', '**/*.astro/*.js', '**/*.astro/*.ts'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
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
