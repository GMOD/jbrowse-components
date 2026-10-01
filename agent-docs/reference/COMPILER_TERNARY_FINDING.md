---
name: compiler-ternary-finding
description: Why babel-plugin-react-compiler can stale a MobX read, and the patterns that avoid it. Read when writing observer components or custom hooks that read MobX, or debugging a stale MobX read.
audience: internal
kind: spec
---

# React Compiler × MobX: memo-dependency coarsening

`babel-plugin-react-compiler` is on globally (`babel.config.cjs`), so it compiles
app code for the browser too. When it memoizes a block, it can drop a MobX update,
because MST nodes mutate in place while keeping stable identity.

## The mechanism

Two ingredients must both be present in a **compiled** function:

- The observable read sits inside a **conditional** (ternary, `&&`), so the
  compiler cannot hoist it to an unconditional per-render `const`.
- That same block passes the node **whole** to a child (`<Child model={model}/>`),
  which coarsens the block's memo dependency from `model.canvasDrawn` to `model`
  identity.

MobX mutates `canvasDrawn` in place with `model` identity stable, so the block
never re-evaluates, MobX unsubscribes, and stale JSX returns. Only a
**stable-identity** carrier is at risk (MST `model`/`view`/`display`/`session`); a
prop or local recreated on change gets a fresh identity. An unconditional read is
re-read every render and stays live:

```js
const a = model.someGetter;        // re-read every render → SAFE

if ($[0] !== id || $[1] !== model) // memoized on (identity, args)
  t1 = model.someMethod(id);       // MST mutates in place → PERMANENTLY STALE
else t1 = $[2];
```

> A compiled function must not call a model **method** whose return value feeds
> render. Property/getter reads are safe.

This is not an upstream bug: coarsening is sound under the compiler's contract
(don't mutate props/state), and MobX violates it by design. `'use no memo'` is the
intended fix.

## What is compiled

- **Inline `observer(function(){})` / `observer(()=>…)` is NOT compiled.** This is
  the house style; always write observers this way.
- **`function Decl(){}; observer(Decl)` IS compiled.** Avoid it, or add
  `'use no memo'`.
- **`use`-prefixed functions are hooks and ARE compiled**, even when every caller
  is an inline observer. A hook wrapping a model method (`useOverlayState` over
  `getTrackOverlayData()` in breakpoint-split-view) froze at first-render values;
  the fix inlined the hook into its one caller. Its regression guard is a browser
  test ("overlay connectors track pan and zoom"), since catching it needs a real
  pan and zoom.
- **Setters/actions in hooks are safe**: they memoize the callback identity, not a
  value.

`DisplayChromeBaseInner` carries `'use no memo'` and is the only compiled
`observer`; its early-`return` terminal branches are a style choice, and
`DisplayChrome.test.tsx` guards the behavior. `DisplayContextMenu` passes
`menuItems={() => model.contextMenuItems()}` as a thunk called on open, so no
render-time method read remains; `contextMenuInfo` is a fresh object per
right-click, which would also defeat staling if the call were ever inlined.

A repo-wide observer opt-out and a custom ESLint rule were rejected: compiling all
tracked `observer` `.tsx` files found only benign coarsened reads, and only the
compiled output discriminates, since source heuristics over- and under-match.

## Writing or auditing a hook that reads MobX

Pass already-read *values* in, or keep the read a plain property access. If you
must call a model method that reads observables, add `'use no memo'` with
`// eslint-disable-next-line react-compiler/react-compiler` above it (the ESLint
plugin wrongly calls the directive unused; the babel plugin that builds the app
does compile the function).

To check a suspicion, compile the file and look for a `_c(n)` cache around the
call:

```js
babel.transformSync(src, { filename, presets: [['@babel/preset-react',{runtime:'automatic'}],'@babel/preset-typescript'], plugins: ['babel-plugin-react-compiler'] })
```

Unit tests run the compiler but catch this only if they re-render after mutating
the observable.

## The uncompiled half

`pnpm test` and every app bundle compile; **published packages do not**, since
`build:esm` is plain tsc. `pnpm test-ci-no-react-compiler` (`NO_RC=1`, its own
`--cacheDirectory` because jest keys entries on file content and transformer
config, not an env var) is the only run exercising that artifact; CI runs it as
"Test (no React Compiler)". Its scope is every workspace whose published `main` is
`build:esm` output: `plugins packages` and `products/jbrowse-react-` (the three
embedding components set `publishConfig.main` to `esm/index.js`).

The gap it closes is the opposite of staleness: the compiler memoizes far more
than the source's explicit `memo`/`useMemo`, so it **stands in for one that is
missing** and a sabotage check stays green (`useViewSvgFigure`'s `memo` was
load-bearing and unverifiable until `NO_RC=1`). A `memo` between a figure and its
parent never covered an `observer` inside the figure against MobX; that reports
itself in both runs ([ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md)
§"Ordering is the contract", the `figure` family).

`'use no memo'` does not substitute: the compiler memoizes the whole chain, so
opting out the component under test moves the absorption a level down and the
check stays green. Switch the plugin off for the run.
