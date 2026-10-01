---
name: linting
description: Which linter owns which rules, why .oxlintrc.json cannot carry comments, why neither linter reports unused disable directives, and the rules measured and rejected. Read before adding a rule or deleting a disable comment.
audience: internal
kind: operations
---

# Linting: who owns what

Four tools, and the split is deliberate.

| tool | runs | owns |
| --- | --- | --- |
| `oxlint` (`pnpm lint:fast`) | pre-commit, CI | correctness, react, unicorn subset, jest, import |
| `oxlint --type-aware` (`pnpm lint`) | pre-commit, CI | the above plus tsgolint's type-aware set |
| `eslint` (`pnpm lint:eslint`) | CI only | react-compiler, @eslint-react, unicorn denylist, the `no-restricted-syntax` guards, astro |
| `oxfmt` | pre-commit, CI | all formatting and import order |

`eslint.config.mjs` carries the reasoning for its own half. This file holds what
does not fit in a config comment, plus the facts about `.oxlintrc.json`.

## `.oxlintrc.json` cannot carry comments

oxlint accepts JSONC, but `eslint.config.mjs` imports the file with
`with { type: 'json' }` to share `ignorePatterns`, and that is a strict
`JSON.parse`. A `//` comment breaks `pnpm lint:eslint` with a parse error that
does not name the comment. A `"//key"` string entry fails too: oxlint reads
every key under `rules` as a rule name. Rationale for an oxlint rule goes in its
commit message.

## Neither linter can report unused disable directives

Both read the same `eslint-disable` comments, and each runs only part of the
rule set, so each sees the other's suppressions as unused. eslint sets
`reportUnusedDisableDirectives: 'off'`; `oxlint --report-unused-disable-directives`
mostly reports eslint-owned rules. Suppressions that suppress nothing therefore
accumulate. The fix is to migrate oxlint-owned suppressions to `oxlint-disable`
and then turn oxlint's check on. Until then, sweep by hand: run oxlint's check,
then filter by which config enables each rule.

**`eslint-disable-next-line` means the next line.** A directive followed by more
comment lines applies to the comment and fails silently. Put the prose first and
the directive last.

## Rules measured and rejected

Each was read site by site. Do not re-propose without new evidence.

- **`unicorn/no-useless-spread`**: autofixable and wrong on every site read.
  `[...someUint32Array.slice(0, n)]` spreads to turn a TypedArray into a
  `number[]` for `toEqual`; the rule reads `.slice()` as returning an Array.
- **`unicorn/no-unsafe-string-replacement`**: the sites that could meet a `$` in
  data take a replacer function; the rest replace with a constant or use `$1`
  on purpose.
- **`unicorn/prefer-combined-guards`**: the fixer declines guards that each carry
  a comment, and `||`-merging the rest fuses unrelated exits.
- **`unicorn/no-immediate-mutation`**: the only rewrite of
  `const xs = []; if (c) xs.push(y)` is `[...(c ? [y] : [])]`, which unicorn will
  not apply in `.ts`.
- **`unicorn/prefer-iterator-zip`**: neither Node nor TypeScript's lib has
  `Iterator.zip`.
- **`unicorn/require-post-message-target-origin`**: `Worker.postMessage`'s second
  parameter is the transfer list, so the fix throws; the one-argument
  `Window.postMessage` already defaults to same origin.
- **`@eslint-react/naming-convention-ref-name`**: wants every `useRef` named
  `*Ref`; ours hold latch values.
- **`@eslint-react/use-state`**: `const [, forceRender] = useState(0)` is the
  force-render idiom.
- **`@eslint-react/set-state-in-effect`**: every site is the reset half of
  fetch-into-state, which cannot be derived during render.
- **jest's default correctness set**: `expect-expect` cannot see
  `assertCanvasHasContent` / `expectCanvasMatch`; `no-conditional-expect` fires on
  branch-then-assert snapshot suites; `no-standalone-expect` flags `expect` in
  `beforeAll`, where suites fail fast on setup; `no-export` flags type-level
  assertions exported so tsc keeps checking them. Five rules are on.

## Array sort comparators are oxlint's

`typescript/require-array-sort-compare` is on with tests exempt;
`unicorn/require-array-sort-compare` is off. The type-aware rule skips
`string[]`; the untyped one flags every sort it cannot type, nearly all of them
string sorts. A test is exempt because a lexicographic sort of numbers fails its
`toEqual` visibly.

## oxlint's react-compiler port is off

oxlint's `react/react-compiler` reports the broader "Rules of React" set, where
`eslint-plugin-react-compiler` reports compilation bailouts, so the two barely
overlap. Every finding on this tree was read and none was a bug.

Most findings are one analysis bug: once a hook returns a ref inside an object,
oxlint treats every property of that object as a ref, so reading a `useState`
value off it is "Cannot access refs during render". Destructuring the same
return (`const { ref, value } = useThing()`) is clean.

The rule is unusable while `useNoteDraft`, `RenderCanvas`'s handle and
floating-ui's `refs` return that shape. Retry after an oxlint upgrade.

The remaining findings are deliberate:

- **`ref.current = value` during render** (`useFetch`, `useDockviewController`)
  is the latest-ref mirror, so the fetch effect depends on the serialized key
  alone. An effect write reorders after the effect that reads it, and
  `useEffectEvent` is banned because it stales inside `observer()`.
- **Lazy ref init** (`storeRef.current ??= …`) is the form React's docs give.
- **A module `let` assigned by a test harness component** is how a hook gets
  exercised; test files only.
- **`MemoDependencies`** is react-compiler's own bookkeeping; `exhaustive-deps`
  reports nothing on the same callbacks.
- **A ref written from an event handler** (`useAlignmentsBase`) is what refs are
  for.
- **`StaticComponents` in `TrackControl`** is a registry lookup, which is also why
  `@eslint-react/static-components` is off.

## Why `@eslint-react` is still installed

oxlint covers `no-array-index-key`, `jsx-key`, `rules-of-hooks`,
`exhaustive-deps`, `no-danger` and `no-unstable-nested-components`. The plugin
still uniquely provides `no-nested-lazy-component-declarations`, `purity`,
`error-boundaries`, `unsupported-syntax` and `no-unnecessary-use-prefix`.
Removing it would also delete every disable comment that names its rules.
