---
name: linting
description: Which linter owns which rules, why .oxlintrc.json cannot carry comments, why neither linter can report unused disable directives, the rules measured and rejected with their counts, and the triage of oxlint's react-compiler port (39 findings, no bugs, 23 from one analysis bug with a minimal repro). Read before adding a rule, adding a plugin, or deleting a disable comment.
---

# Linting: who owns what

Four tools, and the split is deliberate.

| tool | runs | owns | cost |
| --- | --- | --- | --- |
| `oxlint` (`pnpm lint:fast`) | pre-commit, CI | correctness, react, unicorn subset, jest, import | 2.5s whole tree |
| `oxlint --type-aware` (`pnpm lint`) | pre-commit, CI | everything above plus tsgolint's type-aware set | 8s whole tree, ~1s for one commit |
| `eslint` (`pnpm lint:eslint`) | CI only | react-compiler, @eslint-react, unicorn denylist, the `no-restricted-syntax` guards, astro | 30s at `--concurrency=4` |
| `oxfmt` / `prettier` | pre-commit, CI | all formatting, and import order | 5s whole tree |

`eslint.config.mjs` carries the long-form reasoning for its own half. This
file holds what does not fit in a config comment, plus the facts about
`.oxlintrc.json`, which cannot hold comments at all.

## `.oxlintrc.json` cannot carry comments

oxlint accepts JSONC. Node does not: `eslint.config.mjs` does

```js
import oxlintConfig from './.oxlintrc.json' with { type: 'json' }
```

to share `ignorePatterns`, and an import attribute of `type: 'json'` is strict
`JSON.parse`. A `//` comment in that file does not break the file it is written
in — it breaks `pnpm lint:eslint`, several steps away, with a parse error that
does not name the comment. A `"//key": "…"` string entry does not work either;
oxlint reads every key under `rules` as a rule name and rejects the value as a
severity.

So: rationale for an oxlint rule goes in its commit message and, if it is worth
keeping, here.

## Neither linter can report unused disable directives

Both read the same `eslint-disable` comments, and each runs only part of the
rule set, so each sees the other's suppressions as unused:

- eslint has `reportUnusedDisableDirectives: 'off'`. With it on, every
  `eslint-disable @typescript-eslint/*` comment in the tree reports, because
  those rules run in oxlint.
- `oxlint --report-unused-disable-directives` reports 179, of which most name
  eslint-owned rules — `no-console` (28), `@eslint-react/*` (~40),
  `react-refresh/only-export-components` (17).

This is why 39 comments suppressing nothing accumulated before anyone noticed
(deleted in `c7b26da3a8`). The fix is to migrate oxlint-owned suppressions from
`eslint-disable` to `oxlint-disable`, after which oxlint's check can be turned
on for real. Until then, the sweep is manual: run oxlint's check, then filter by
which config actually enables each rule.

**`eslint-disable-next-line` means the next line.** A directive followed by more
comment lines applies to the comment, not the code, and fails silently — the
error stays. Put the prose first and the directive last.

## Rules measured and rejected

Counts are from a full run; each was read site by site before rejecting. Do not
re-propose these without new evidence.

- **`unicorn/no-useless-spread`** (7) — its fix is wrong on every site *and* it
  is autofixable, so `--fix` applies all seven silently. Six are
  `[...someUint32Array.slice(0, n)]`, where the spread is the point: it turns a
  TypedArray into a `number[]` so `expect(…).toEqual([…])` matches. The rule
  reads `.slice()` as returning an Array. The seventh is a snapshot taken around
  a `Map.delete` inside its own loop.
- **`unicorn/require-post-message-target-origin`** (3) — two are
  `Worker.postMessage`, whose second parameter is the transfer list, so the
  suggested `, instance.location.origin` fix throws. The third is a real
  `Window.postMessage`, but the one-argument form already defaults
  `targetOrigin` to `"/"` (same origin), so there is nothing to fix.
- **`@eslint-react/naming-convention-ref-name`** (10) — wants every `useRef`
  named `*Ref`; all of ours hold latch values rather than elements.
- **`@eslint-react/use-state`** (4) — `const [, forceRender] = useState(0)` is
  the force-render idiom, and `setEntriesState` is named apart from a real
  `setEntries` wrapper the rename would collide with.
- **`@eslint-react/set-state-in-effect`** (3) — all three are the reset half of
  fetch-into-state, the one thing that cannot be derived during render.
- **jest's default correctness set** (348) — `expect-expect` (162) cannot see
  `assertCanvasHasContent` / `expectCanvasMatch`; `no-conditional-expect` (83)
  fires on the snapshot suites' branch-then-assert; `no-standalone-expect` flags
  `expect` inside `beforeAll`, which is how three suites fail fast on setup;
  `no-export` flags two files exporting a never-called type-level assertion so
  tsc keeps checking its body. Five rules are on, the rest off.

## oxlint's react-compiler port: triaged, and off

oxlint ships `react/react-compiler`, and it is not the same check as
`eslint-plugin-react-compiler@19.1.0-rc.2`. On this tree it reports 39 findings
the eslint plugin does not, in 1.5s against that plugin's 11.5% of a 30s eslint
run. All 39 were read, 2026-08-10. **None is a bug**, and the rule stays off.

The eslint plugin does fire — two sites carry
`eslint-disable react-compiler/react-compiler`, both above a `'use no memo'`
directive. What it reports is compilation bailouts. oxlint's port reports the
broader "Rules of React" set, which is why the two barely overlap.

**23 of the 39 are one analysis bug.** Once a hook returns a ref inside an
object, oxlint treats every property of that object as a ref, so reading a
`useState` value off it is "Cannot access refs during render". Minimal repro —
`A` is flagged twice, `B` not at all, and they are the same program:

```tsx
function useThing() {
  const ref = useRef<HTMLInputElement>(null)
  const [value] = useState('')
  return { ref, value }
}
export function A() {
  const thing = useThing()
  return <input ref={thing.ref} value={thing.value} /> // 2 findings
}
export function B() {
  const { ref, value } = useThing()
  return <input ref={ref} value={value} /> // clean
}
```

A real `ref.current` read during render is still caught, so the rule is not
useless — it is unusable while `useNoteDraft`, `RenderCanvas`'s handle and
floating-ui's `refs` object all return that shape. Retry after an oxlint upgrade
by re-running the snippet above.

The other 16, all deliberate:

| finding | n | why it stays |
| --- | --- | --- |
| `ref.current = value` during render (`useFetch`, `useDockviewController`) | 4 | The latest-ref mirror, so the fetch effect depends on the serialized key alone. Moving the write into an effect reorders it after the effect that reads it. The React-sanctioned alternative, `useEffectEvent`, is banned here — it stales inside `observer()`. |
| lazy ref init, `storeRef.current ??= …` (`useMouseTracking`) | 2 | The form React's own docs give for expensive ref initialization. |
| module `let` reassigned by a test harness component | 4 | `let api; function Harness(){ api = useHook() }` — how a hook gets exercised. Test files only. |
| `MemoDependencies` in `useReview` | 3 | `exhaustive-deps` reports 0 on the same three callbacks. This is react-compiler's own memoization bookkeeping, not a dependency bug. |
| `Immutability` in `useAlignmentsBase` | 1 | The write is in `handleCanvasMouseMove`, an event handler. Writing a ref from an event handler is what refs are for. |
| `EffectSetState` in `useMateDiscovery` | 1 | Same site `@eslint-react/set-state-in-effect` flags; see the rejected list above. |
| `StaticComponents` in `TrackControl` | 1 | `use(TrackControlContext) ?? MuiTrackControl` — a registry lookup, which is exactly why `@eslint-react/static-components` is off too. |

## Why `@eslint-react` is still installed

Asked and answered 2026-08-10. oxlint now covers `no-array-index-key`,
`jsx-key`, `rules-of-hooks`, `exhaustive-deps` (0 findings), `no-danger` and
`no-unstable-nested-components`, which is most of what the plugin was doing.
What is left is genuinely unique: `no-nested-lazy-component-declarations`
(confirmed against a scratch file — oxlint misses it), `purity`,
`error-boundaries`, `unsupported-syntax`, `no-unnecessary-use-prefix`.

Removing it also means deleting 44 disable comments that name its rules, 30 of
them `no-array-index-key`. Since dropping the duplicated
`@eslint-react/rules-of-hooks` took the eslint run from 1:17 to 30s, there is no
longer a speed argument for the rest: what remains is ~9% of 30s.
