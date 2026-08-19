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
const noExportStar = {
  selector: 'ExportAllDeclaration',
  message:
    "Do not use `export *` / `export type *`. List the names explicitly (`export { a, b } from './x.ts'`) so a barrel's public surface is greppable and a new internal export can't silently become package API. Regenerate a list with the TS checker rather than hand-writing it.",
}
// Those below pin invariants CLAUDE.md already states, each of which fails
// silently — the code keeps working, just wrongly, so no test catches them.
// Unnumbered on purpose: this said "three" while listing four.
const noNamedObserver = {
  selector: "CallExpression[callee.name='observer'] > Identifier.arguments",
  message:
    'Write `observer(function Name() {…})` inline. babel-plugin-react-compiler does not compile an inline observer, but it DOES compile the `function Name(){}; observer(Name)` form, and a compiled MobX render can serve a stale read. See the React Compiler × MobX section of CLAUDE.md.',
}
const noSetSlot = {
  selector:
    "CallExpression[callee.property.name='setSlot'][callee.object.property.name='configuration']",
  message:
    'Write config with `setConf`, not `configuration.setSlot`. A promotable slot resolves only through `resolveConf`, and setSlot writes past that. See the MST section of CLAUDE.md.',
}
const noAnyStateTreeNode = {
  selector:
    "TSInterfaceHeritage > TSQualifiedName[right.name='IAnyStateTreeNode'], TSInterfaceHeritage > Identifier[name='IAnyStateTreeNode']",
  message:
    'A duck-typed interface extends `IStateTreeNode`, never `IAnyStateTreeNode`. The latter resolves through `STNValue<any, …>` to `any`, which silently turns off checking for every member you just declared. See the MST section of CLAUDE.md.',
}
const noTrackWidthPx = {
  selector: "MemberExpression[property.name='trackWidthPx']",
  message:
    'Read `model.canvasWidthPx`, not `view.trackWidthPx`. Four view getters answer plausibly and MAF drifted onto the wrong one; the two agree today, so a second spelling is silent until one of them moves. See MultiRegionDisplayMixin.canvasWidthPx.',
}
// plugins/alignments/src/CLAUDE.md states this one and also states why it needs a
// linter rather than a reviewer: the flag agrees with `strand` on every BAM under
// test and disagrees only on the flagless PAF/synteny blocks the same pipeline
// serves, so a conversion written anywhere else "survives review and ships".
// Every strand bug this plugin has had was that.
const noSamFlagReverse = {
  selector: "Identifier[name='SAM_FLAG_REVERSE']",
  message:
    'SAM_FLAG_REVERSE may only become a strand inside an adapter feature class (SamRecordFeature.strand). Everywhere downstream reads `getStrand(feature)` / `readStrands[i]` / `FeatureData.strand`, which is universal — `getFlags` returns 0 for a PAF/synteny block, so a flag-derived strand reports every one of them forward. Rules needing a strand AND a flag live in shared/util.ts (firstOfPairStrand). See plugins/alignments/src/CLAUDE.md.',
}
// The mutation `withRegionRef` exists to prevent. Nothing does it today; the rule
// is here so nothing starts, because the failure is a wrong picture rather than a
// crash — regionRefAliasing.test.ts is the regression test.
// `computed=false` matters: `best[ref] = …` is a MemberExpression whose property
// is the identifier `ref`, and 38 of those exist in the mod-probability walks.
const noRecordRefMutation = {
  selector:
    "AssignmentExpression[left.type='MemberExpression'][left.computed=false][left.property.name='ref']",
  message:
    "Do not assign `record.ref = …`. @gmod/bam memoizes decoded records in a per-file chunk LRU, so two queries can be handed the identical objects and the last fetch to resolve rebinds the reference for every other region — resolving one region's mismatches against another region's sequence. Use `record.withRegionRef(packedRef)`, which returns a bound view. See plugins/alignments/src/CLAUDE.md and regionRefAliasing.test.ts.",
}

// `rpcManager.call` reached two ways — off a binding, and off `getSession(…)` /
// `session` — and a payload built as an object literal rather than spread from
// something already carrying the handles.
const rpcCallArgs = [
  "CallExpression[callee.property.name='call'][callee.object.name='rpcManager']",
  "CallExpression[callee.property.name='call'][callee.object.property.name='rpcManager']",
]
// A spread is accepted as forwarding: the rule cannot see inside one, and the
// six call sites that use it are wrappers handing on a `BaseOptions`-shaped bag
// that declares both handles.
const missingRpcHandle = handle =>
  rpcCallArgs
    .map(
      call =>
        `${call} > ObjectExpression:not(:has(> Property[key.name='${handle}'])):not(:has(> SpreadElement))`,
    )
    .join(', ')

// `RpcHandles` is optional on `RpcCallArgs` and has to stay optional — a
// plugin-facing argument may be added optional and never made required
// (reference/PLUGIN_ABI_STABILITY.md), so the compiler cannot ask for these.
// Which leaves them exactly as forgettable as `RpcMethodType`'s own docstring
// describes: "the two handles every method receives are the two an author who
// did not write them down never forwards". `CoreGetExportData` shipped without
// either, so the Save-track-data dialog's cancel did nothing and its progress
// never moved.
//
// Silent is the whole problem, not absent — plenty of calls should report
// nothing (a memoized header read, a refName lookup, CoreFreeResources). This
// makes that a stated decision instead of an unnoticed one: disable the rule on
// the line and say why.
const noUnreportedRpcCall = {
  selector: missingRpcHandle('statusCallback'),
  message:
    "This rpcManager.call passes no `statusCallback`, so whatever it does is invisible — a spinner with no phase label and no bar. Pass `ctx.statusCallback` (FetchContext / createStopTokenRotation), useFetch's, or the display's `makeStatusCallback`. If it should genuinely report nothing, `// eslint-disable-next-line no-restricted-syntax` with the reason. See agent-docs/reference/PROGRESS_REPORTING.md.",
}
const noUncancellableRpcCall = {
  selector: missingRpcHandle('stopToken'),
  message:
    'This rpcManager.call passes no `stopToken`, so nothing can stop the worker once the user moves on or closes the dialog — it keeps its in-flight HTTP reads too. Pass `ctx.stopToken`, or the token useFetch hands the fetcher. If the work is genuinely uninterruptible or too short to matter, `// eslint-disable-next-line no-restricted-syntax` with the reason. See agent-docs/reference/PROGRESS_REPORTING.md.',
}

// The other end of the two above: having decided a call reports nothing, don't
// manufacture a reporter for it one frame later. `statusCallback` is optional
// the whole way down and every consumer branches on the absence —
// `downloadStatus` withholds the reader's `onProgress`, `createProgressReporter`
// skips its emit, `openPhase` allocates no stack. A no-op default is truthy at
// all three, so it turns those branches off while reading like a tidy-up.
// Thirty-one adapters had one.
//
// The point is that the caller's decision survives, not that the resulting read
// is faster — it usually isn't
// (agent-docs/measurements/download-read-path.json).
const noNoOpStatusCallbackDefault = {
  selector:
    "AssignmentPattern[left.name='statusCallback'] > ArrowFunctionExpression",
  message:
    'Do not default `statusCallback` to a no-op. It is optional everywhere below you and the absence is a live branch — a no-op is truthy, so it silently overrides a caller who asked for no reporting and pays for progress nobody reads. Leave it `StatusCallback | undefined` and let `updateStatus`/`downloadStatus`/`createProgressReporter` handle it; call it as `statusCallback?.(…)`. See agent-docs/reference/PROGRESS_REPORTING.md.',
}

// The set every file gets. A block below that needs its own extra selectors
// spreads this rather than re-listing it — flat config overrides the rule
// instead of merging it, so a hand-copied list is a list that drifts, which is
// what the three copies of `noExportStar` used to be.
const restrictedSyntax = [
  noMockFromSrc,
  noReadableFromWeb,
  noExportStar,
  noNamedObserver,
  noAnyStateTreeNode,
]

// The set every non-test file gets. Named because the drift the comment above
// warns about had already happened to it twice: the two blocks that carve out one
// file each (`MultiRegionDisplayMixin`, `renderSvg.tsx`) re-listed `restrictedSyntax`
// by hand and so silently turned OFF the four source-only rules there — including
// both RPC-handle guards, in the two places most likely to call an RPC. Neither
// scope violates them today, so nothing was reported; that is the point. A block
// carving out one rule filters this list rather than rebuilding it.
const sourceRestrictedSyntax = [
  ...restrictedSyntax,
  noSetSlot,
  noTrackWidthPx,
  noSamFlagReverse,
  noRecordRefMutation,
  noUnreportedRpcCall,
  noUncancellableRpcCall,
  noNoOpStatusCallbackDefault,
]

export default defineConfig(
  {
    // Agent worktrees live at `.claude/worktrees/<branch>/` — whole extra
    // checkouts inside the repo root. oxlint never sees them because it honors
    // `.gitignore`, which has `.claude/*`; ESLint's flat config reads no
    // ignore file, so it walked every worktree and linted the entire tree once
    // per concurrent session. That is not just slow: another agent editing its
    // own worktree mid-run deletes a file this run already enumerated, and the
    // whole command dies `ENOENT` on a path that has nothing to do with the
    // caller's change.
    //
    // Anchored, and that is the point — `.claude/**` contains a slash, so flat
    // config resolves it against the config's own directory rather than at any
    // depth. Running from INSIDE a worktree, that directory is the worktree, so
    // this matches its (empty) `.claude/` and not the `.claude/` in the
    // absolute path above it. The unanchored spelling would match every file in
    // the worktree and silently lint nothing — the trap `jest.config.js`'s
    // `modulePathIgnorePatterns` comment describes, which is the same rule for
    // the same reason.
    ignores: [...oxlintConfig.ignorePatterns, '.claude/**'],
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
    // **This `files` is what makes the config lint TypeScript at all**, and
    // leaving it off does not fail — it silently shrinks the run. A flat-config
    // object with no `files` applies only to files *some other object already
    // matches*, and ESLint's own default set is just `**/*.js`/`.mjs`/`.cjs`.
    // Every block below that names a `.ts` path (`**/*.generated.ts`,
    // `website/src/**/*.ts`, the electron and examples-site blocks) was
    // therefore doing double duty: turning a rule off *and* being the only
    // reason those files were linted in the first place. Everything else —
    // `packages/**/src`, `plugins/**/src`, all of `products/*/src` — matched
    // nothing and was skipped without a word. 461 files of ~4900.
    //
    // The rules this config exists for are exactly the ones that needed the
    // missing 90%: `react-compiler`, `@eslint-react`, `react-refresh`, and the
    // `useEffectEvent` import guard whose message begins "nearly every JBrowse
    // component is an observer". None of them had ever run on a component.
    //
    // `.astro` is deliberately absent; its own block near the bottom adds it,
    // along with the parser its frontmatter needs.
    files: ['**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}'],
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
      // 752 — one-line `/** Read is unmapped */` above a constant or a field is
      // the house JSDoc style, and this wants every one of them expanded to
      // three lines. Comment layout is the formatter's half of the split this
      // config's header describes, and oxfmt leaves these alone.
      'unicorn/single-line-block-comment-style': 'off',

      // === Opinionated / high-churn, intentionally not adopted ===
      'unicorn/no-null': 'off', // 1035 — null is intentional in JSON/DOM/MST
      'unicorn/consistent-boolean-name': 'off', // 811 — would rename serialized config-slot/prop names
      'unicorn/numeric-separators-style': 'off', // 2051 — purely cosmetic churn
      'unicorn/no-this-outside-of-class': 'off', // 351 — conflicts with MST `self` patterns

      // Uint8Array toBase64()/fromBase64() aren't widely-available baseline yet.
      'unicorn/prefer-uint8array-base64': 'off',
      // Fires on `const drained = queue.splice(0)`, where the returned array
      // IS the point — an atomic drain-and-clear. `.length = 0` would throw
      // the elements away. The rule's premise only holds when the return value
      // is discarded, and it does not check that.
      'unicorn/no-unnecessary-splice': 'off',

      // === Conflicts with repo conventions (nest / ternaries over early return) ===
      'unicorn/prefer-early-return': 'off', // 74 — we prefer nesting over early return
      'unicorn/no-useless-else': 'off', // 93 — pushes early-return de-nesting
      'unicorn/no-lonely-if': 'off', // 6 — nesting preference
      'unicorn/no-negated-condition': 'off', // 180
      'unicorn/no-nested-ternary': 'off', // 166 — nested ternaries are fine here

      // === Deferred: valid rules not adopted in this first pass. Enable
      // incrementally; the number is the violation count at deferral time. ===
      // These five surfaced when the config started matching `**/*.ts` — the
      // counts are from that first full run, not from a rule upgrade.
      'unicorn/no-duplicate-loops': 'off', // 11 — `for (const x of xs.filter(…))`; a perf claim, not a correctness one
      'unicorn/prefer-then-catch': 'off', // 7 — NOT a safe rewrite: `.then(a, b)` does not route a's own throw to b, `.then(a).catch(b)` does. Each site needs reading
      // Off, and do NOT try again: its fix is wrong on every remaining site.
      // Six are `[...someUint32Array.slice(0, n)]`, where the spread is the
      // whole point — it turns a TypedArray into a `number[]` so `toEqual([…])`
      // can match it — and the rule reads `.slice()` as returning an Array.
      // The seventh is `for (const x of [...this.drafts])` around a
      // `this.drafts.delete()`, where the snapshot is the guard. This one is
      // autofixable, so `--fix` applies all seven silently.
      'unicorn/no-useless-spread': 'off',
      // Off: both sites are `el.querySelectorAll('svg > g > g')` in tests,
      // where nothing is ambiguous about which subtree is being searched.
      'unicorn/prefer-scoped-selector': 'off',
      // Off: it is the nested-ternary family, and the four entries above
      // already reject that. Its one site is the shader literal formatter,
      // whose branches carry a comment each.
      'unicorn/no-unnecessary-nested-ternary': 'off',
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
      // oxlint runs react/rules-of-hooks, so this is the same check twice on
      // every file. It was 5.4% of this config's runtime — the third most
      // expensive rule here — for a verdict already reached in the 2.5s
      // linter. The header above says oxlint owns react-hooks; this makes
      // that true.
      '@eslint-react/rules-of-hooks': 'off',
      // Vite resource queries (`?raw`, `?url`, etc.) make an import resolve to
      // different content than the bare path; without this, no-duplicates
      // treats e.g. `from './x.tsx'` + `from './x.tsx?raw'` as duplicates.
      'import-x/no-duplicates': ['error', { considerQueryString: true }],
      'import-x/extensions': ['error', 'ignorePackages'],
      // Adopted out of the deferred list below: one site each (PaletteContext),
      // now fixed. On so the next context added stays on the React 19 spelling.
      '@eslint-react/no-context-provider': 'error',
      '@eslint-react/no-use-context': 'error',
      // Adopted for its ratio, not its count. One unsuppressed site; the value
      // is the 30 `eslint-disable @eslint-react/no-array-index-key -- …`
      // comments in the tree, which said nothing at all while the rule was off.
      '@eslint-react/no-array-index-key': 'error',
    },
  },
  {
    // ---------------------------------------------------------------------
    // What is left of the backlog from the day this config started matching
    // `**/*.ts`. Until then it linted 461 files of ~4900, so none of these
    // rules had run on packages/*/src, plugins/*/src or products/*/src, and
    // the first full run raised 1001 problems.
    //
    // Most of what stayed here has now been read site by site, and the honest
    // answer for all but one was reject, not defer — a "deferred" line nobody
    // can act on is worse than an "off, because" line, because it reads as a
    // promise. The reasons are below. Anything genuinely deferred keeps its
    // count and says what the work is.
    // ---------------------------------------------------------------------
    rules: {
      // 26 in 20 files, and still a to-do: each exports a helper beside a
      // component, so fixing means splitting files and rewiring imports. The
      // 17 inline disables in the tree are dead while this is off.
      'react-refresh/only-export-components': 'off',

      // Off, not deferred: it wants every useRef named `*Ref`, and all 10 of
      // ours hold latch values rather than elements — `shown`, `cursor`,
      // `lastWheelAt`, `held`, `atFocus`. `lastWheelAt.current` says what it
      // is; `lastWheelAtRef.current` says it twice. Same call as
      // unicorn/prevent-abbreviations above: a naming preference we don't share.
      '@eslint-react/naming-convention-ref-name': 'off',

      // Off, not deferred: it wants the setter of `useState(x)` named `setX`,
      // and our four exceptions are all deliberate. `const [, forceRender] =
      // useState(0)` is the force-render idiom. `setEntriesState` is named
      // apart from the `setEntries` wrapper that writes the ref alongside it,
      // so the rule's rename would collide with a real function.
      '@eslint-react/use-state': 'off',

      // Off, not deferred: all three are the reset half of fetch-into-state
      // (`setRows(undefined)` before an await), which is the pattern the rule
      // exists to catch and also the one thing you cannot derive during
      // render — the state is the user's after it seeds, they reorder and
      // uncheck it. The React answer is a `key` on the component, which is the
      // caller's to give, not this file's.
      '@eslint-react/set-state-in-effect': 'off',
    },
  },
  {
    // Node-side tooling, where printing to stdout IS the output. The last five
    // entries only became reachable when this config started matching `**/*.ts`
    // — `plugins/data-management/scripts/*.js` was the whole of the plugin
    // entry because a `.ts` sibling would not have been linted anyway.
    files: [
      'babel.config.js',
      'config/webpack/**/*',
      'scripts/**/*',
      'website/scripts/**/*',
      'products/jbrowse-img/**/*',
      'products/jbrowse-web/scripts/*',
      'products/jbrowse-cli/**/*',
      'products/jbrowse-desktop/sign.cjs',
      'plugins/*/scripts/**/*',
      // Both, not just plugins/: packages/core/benches was outside this glob
      // and its four console.logs sat red on main until a push found them.
      '{packages,plugins}/*/benches/**/*',
      // Puppeteer drivers: they print the measurement they were run to take.
      'products/jbrowse-web/browser-tests/**/*',
      // The capture CLI's entry point, and the shared examples-site doc-link
      // checker whose `log = console.log` default is its reporting channel.
      'products/jbrowse-capture/src/bin.ts',
      'packages/browser-test-utils/**/*',
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
    // Jest specs run under node, so `process`, `__dirname` and friends are
    // real. Without this the browser-only globals list makes `process.env` an
    // undeclared variable, and unicorn's optional-chaining rule then reports a
    // ReferenceError that cannot happen (`liveProxy.test.ts` reads
    // `process.env.JBROWSE_UCSC_PROXY_URL?.replace(…)`).
    files: ['**/*.test.{ts,tsx}', '**/tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
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
      'no-restricted-syntax': ['error', ...restrictedSyntax],
    },
  },
  {
    // setConf-over-setSlot is a source rule, not a test rule. 44 of the 47
    // findings are fixtures reaching straight for a slot, where there is no
    // promotable-slot resolution to route around and `setSlot` is the shorter
    // way to say it. In source there were three, one of which is `setConf`
    // itself.
    ignores: ['**/*.test.{ts,tsx}', '**/tests/**', '**/browser-tests/**'],
    rules: {
      'no-restricted-syntax': ['error', ...sourceRestrictedSyntax],
    },
  },
  // The one file allowed to read `trackWidthPx`: the getter that answers the
  // width question for everyone else. `LinearGenomeView/model.ts` defines it and
  // is not a read, so it needs no entry.
  {
    files: [
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/MultiRegionDisplayMixin.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...sourceRestrictedSyntax.filter(s => s !== noTrackWidthPx),
      ],
    },
  },
  // The sanctioned home of the SAM_FLAG_REVERSE → strand conversion, plus the
  // package that defines and re-exports the constant. Everything else reads
  // `getStrand`.
  {
    files: [
      'plugins/alignments/src/SamAdapter/**/*.{ts,tsx}',
      'packages/cigar-utils/src/**/*.{ts,tsx}',
    ],
    // Same carve-out as the source block this overrides, or a test under either
    // path would get the source-only rules switched back on.
    ignores: ['**/*.test.{ts,tsx}', '**/tests/**', '**/browser-tests/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...sourceRestrictedSyntax.filter(s => s !== noSamFlagReverse),
      ],
    },
  },
  // Shader codegen emits `export *` and must not be hand-edited (run
  // `pnpm gen:shaders`), and each product's webpack entry deliberately
  // re-exports the third-party `react-dom/client` surface — pinning a name list
  // there would freeze someone else's API.
  {
    files: ['**/*.generated.ts', 'products/*/src/webpack.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...restrictedSyntax.filter(s => s !== noExportStar),
      ],
    },
  },
  // Style rules can't apply to codegen output: the transpiler emits `1.0` for a
  // float literal and nests Math.max to mirror the shader's own two-argument
  // max, and autofixing either edits a file `pnpm gen:shaders` immediately
  // overwrites — the Shaders CI job diffs it.
  {
    files: ['**/*.generated.ts'],
    rules: {
      'unicorn/no-zero-fractions': 'off',
      'unicorn/prefer-flat-math-min-max': 'off',
    },
  },
  // Guards against regressions in the SVG-export pipeline. See
  // agent-docs/ARCHITECTURE.md §"SVG export".
  // Heavy draw paths must go through paintLayer; clipPath wrappers must use
  // SvgClipRect for consistency.
  // NOTE: must come after the global no-restricted-syntax block above so that
  // both selector sets apply to renderSvg.tsx (flat config overrides, not merges).
  {
    files: ['plugins/**/renderSvg.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...sourceRestrictedSyntax,
        {
          selector: "NewExpression[callee.name='SvgCanvas']",
          message:
            'Use paintLayer(width, height, opts, ctx => drawXxxToCtx(ctx, …)) instead of constructing SvgCanvas directly. See agent-docs/ARCHITECTURE.md §"SVG export".',
        },
        {
          selector: "JSXOpeningElement[name.name='clipPath']",
          message:
            'Use <SvgClipRect> from @jbrowse/plugin-linear-genome-view instead of hand-rolling <defs><clipPath><rect>. See agent-docs/ARCHITECTURE.md §"SVG export".',
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
      // reads a WebGL `gl.useProgram` override as a misnamed hook
      '@eslint-react/no-unnecessary-use-prefix': 'off',
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
  // The one file that has to reach another package's src: it pins the app's
  // format guesser to the CLI's, and @jbrowse/cli publishes a binary rather
  // than an importable entry point, so there is no public API to compare
  // against. The useEffectEvent path stays on.
  {
    files: ['products/jbrowse-web/src/addTrackFormats.test.ts'],
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
