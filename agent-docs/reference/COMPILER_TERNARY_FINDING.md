---
name: compiler-ternary-finding
description: Why babel-plugin-react-compiler can stale a MobX read, and the patterns that avoid it. Read when writing observer components or custom hooks that read MobX, or debugging a stale MobX read.
audience: internal
---

# React Compiler × MobX: memo-dependency coarsening

`babel-plugin-react-compiler` is on globally (`babel.config.cjs`), so it compiles
app code for the browser too — this is a production effect, not a test artifact.
When it memoizes a block, it can drop a MobX update, because MST nodes mutate in
place while keeping stable identity.

## The mechanism

Two ingredients must both be present in a **compiled** function:

- The observable read sits inside a **conditional** (ternary, `&&`, nested
  ternary), so the compiler can't hoist it to an unconditional per-render
  `const` and it stays inside a memoized block.
- That same block passes the node **whole** to a child (`<Child model={model}/>`),
  which coarsens the block's memo dependency from `model.canvasDrawn` to `model`
  identity.

MobX mutates `canvasDrawn` in place with `model` identity stable, so the block
never re-evaluates, the read never re-runs (MobX unsubscribes), and stale JSX is
returned. Only a **stable-identity** carrier is at risk — MST nodes
(`model`/`view`/`display`/`session`). A plain prop or local recreated when its
content changes gets a fresh identity, so the coarse gate still fires.

An unconditional read is emitted verbatim and re-read every render, so MobX
tracks it and it stays live. The same rule stated for a method call:

```js
const a = model.someGetter;        // re-read every render → SAFE

if ($[0] !== id || $[1] !== model) // memoized on (identity, args)
  t1 = model.someMethod(id);       // MST mutates in place → PERMANENTLY STALE
else t1 = $[2];
```

> A compiled function must not call a model **method** whose return value feeds
> render. Property/getter reads are safe.

This is not an upstream bug: coarsening is sound under the compiler's contract
(don't mutate props/state); MobX violates that by design. The escape hatch
(`'use no memo'`) is the intended fix, and the cases that work are accidental
alignment, not a guarantee.

## What is compiled, and what that means in practice

- **Inline `observer(function(){})` / `observer(()=>…)` is NOT compiled** — the
  house style, so most MobX reads never reach the compiler. Always write
  observers this way.
- **`function Decl(){}; observer(Decl)` IS compiled** — avoid it, or add
  `'use no memo'`.
- **`use`-prefixed functions are hooks and ARE compiled**, even when every caller
  is an inline observer. "No compiled observers" ≠ "no compiled MobX reads".
- **Setters/actions in hooks are safe**: `model.setX(...)` in a handler or effect
  memoizes the callback identity, not a value.

## Live status

- `DisplayChromeBaseInner` carries `'use no memo'` — the only compiled
  `observer` in the codebase. Its early-`return` terminal branches are now a style choice, not
  a correctness requirement; `DisplayChrome.test.tsx` guards the behavior.
- `useOverlayState` → `getTrackOverlayData()` (breakpoint-split-view) shipped a
  real bug from this — panning froze the overlay connectors, zooming threw them
  millions of px off-screen. Fixed with `'use no memo'`; the regression guard is
  a browser test (`browser-tests/suites/breakpoint-split-view.ts`, "overlay
  connectors track pan and zoom") because catching it needs a real pan/zoom.
- `useVariantCanvasInteraction` → `model.contextMenuItems()` no longer runs
  during render at all: it is passed to `ContextMenu` as the thunk
  `menuItems={() => model.contextMenuItems()}` and called when the menu opens,
  so there is no render-time read left to coarsen. What the hook does hold is
  `contextMenuAnchor`, a `{ clientX, clientY }` object (`ContextMenuAnchor`)
  built fresh on each right-click, with `undefined` as the closed state. Were
  the call ever inlined into JSX again, that freshness is what would keep it
  from staling — and it would stop protecting anything the moment the anchor
  became a stable value.
- A repo-wide observer opt-out and a custom ESLint rule were both rejected: an
  audit compiling all 431 tracked `observer` `.tsx` files found 14 coarsened
  reads, all benign (props/locals recreated on change, or non-observables like
  `classes` from `useStyles`), and only the compiled output truly discriminates —
  source heuristics over- and under-match.

## Writing or auditing a hook that reads MobX

Prefer passing already-read *values* in, or keep the read a plain property
access. If you must call a model method that reads observables, add
`'use no memo'` with `// eslint-disable-next-line react-compiler/react-compiler`
above it — the ESLint plugin wrongly calls the directive unused, while the babel
plugin that builds the app really does compile the function.

To check a suspicion, compile the file and look for a `_c(n)` cache around the
call:

```js
babel.transformSync(src, { filename, presets: [['@babel/preset-react',{runtime:'automatic'}],'@babel/preset-typescript'], plugins: ['babel-plugin-react-compiler'] })
```

Unit tests do run the compiler, but only catch this if they re-render after
mutating the observable.

## The uncompiled half, and the job that runs it

`pnpm test` and every app bundle compile. The **published packages do not** —
`build:esm` is plain tsc, so an npm consumer of `@jbrowse/plugin-*` executes code
no compiler ever saw. `pnpm test-ci-no-react-compiler` (`NO_RC=1`, scoped to
`plugins packages`, its own `--cacheDirectory` because jest keys entries on file
content and transformer config and an env var is neither) is the only run that
exercises that artifact, and CI runs it as "Test (no React Compiler)".

The gap it closes is the opposite of the staleness above: the compiler memoizes
far more than the source's explicit `memo`/`useMemo`, so it **stands in for one
that is missing** and a sabotage check stays green. `useViewSvgFigure`'s `memo`
was load-bearing and unverifiable by any run in the repo for exactly this
reason — deleting it failed nothing compiled, and fails the figure's freeze test
immediately under `NO_RC=1`.

What that `memo` never covered is the other direction, and no run tells you
either: it sits between the figure and its parent, not between an `observer`
inside the figure and MobX. That one reports itself in both runs now — see
[ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) §"Ordering is the contract",
the `figure` family.

Reaching for `'use no memo'` instead does not work: the compiler memoizes the
whole chain, so opting out the one component under test moves the absorption a
level down and the check stays green. Switch the plugin off for the run.
