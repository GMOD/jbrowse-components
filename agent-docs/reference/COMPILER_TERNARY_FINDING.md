---
name: compiler-ternary-finding
description: Why babel-plugin-react-compiler can stale a MobX read, and the patterns that avoid it. Read when writing observer components or custom hooks that read MobX, or debugging a stale MobX read.
audience: internal
kind: spec
---

# React Compiler × MobX: memo-dependency coarsening

`babel-plugin-react-compiler` is on globally (`babel.config.cjs`). MST nodes mutate in
place with stable identity, so a memoized block can drop a MobX update.

## The mechanism

A **compiled** function goes stale when both hold:

- The observable read sits inside a conditional (ternary, `&&`), so the compiler cannot
  hoist it to a per-render `const`.
- The same block passes the node whole to a child (`<Child model={model}/>`), which
  coarsens the block's memo dependency to `model` identity.

Only stable-identity carriers (MST `model`/`view`/`display`/`session`) are at risk.
Unconditional property or getter reads stay live.

**A compiled function must not call a model method whose return value feeds render.** The
compiler memoizes it on `(identity, args)` and it stays stale. This is sound under the
compiler's contract (don't mutate props/state), which MobX violates by design, so
`'use no memo'` is the fix.

## What is compiled

- Inline `observer(function(){})` and `observer(()=>…)` are not compiled. Always write
  observers this way.
- `function Decl(){}; observer(Decl)` is compiled. Avoid it, or add `'use no memo'`.
- `use`-prefixed functions are hooks and are compiled, even when every caller is an inline
  observer. A hook wrapping a model method (`useOverlayState` over `getTrackOverlayData()`)
  froze at first-render values; a browser test ("overlay connectors track pan and zoom")
  guards it, since catching it needs a real pan and zoom.
- Setters and actions in hooks are safe: they memoize callback identity, not a value.

`DisplayChromeBaseInner` carries `'use no memo'` and is the only compiled `observer`;
`DisplayChrome.test.tsx` guards it. `DisplayContextMenu` passes
`menuItems={() => model.contextMenuItems()}` as a thunk so no render-time method read
remains.

A repo-wide observer opt-out and a custom ESLint rule were rejected: compiling every
tracked `observer` `.tsx` found only benign coarsened reads, and only compiled output
discriminates.

## Writing or auditing a hook that reads MobX

Pass already-read values in, or keep the read a plain property access. To call a model
method that reads observables, add `'use no memo'` with
`// eslint-disable-next-line react-compiler/react-compiler` above it; the ESLint plugin
wrongly calls the directive unused. To check a suspicion, compile the file with
`babel.transformSync` and `babel-plugin-react-compiler` and look for a `_c(n)` cache around
the call. Unit tests catch it only if they re-render after mutating the observable.

## The uncompiled half

`pnpm test` and every app bundle compile; published packages do not, since `build:esm` is
plain tsc. `pnpm test-ci-no-react-compiler` (`NO_RC=1`, its own `--cacheDirectory` because
jest keys entries on file content and transformer config, not an env var) is the only run
exercising that artifact. Its scope is every workspace whose published `main` is
`build:esm` output.

The compiler memoizes far more than the source's explicit `memo`/`useMemo`, so it stands in
for a missing one and a sabotage check stays green (`useViewSvgFigure`'s `memo` was
load-bearing and unverifiable until `NO_RC=1`). `'use no memo'` does not substitute: the
compiler memoizes the whole chain, so opting out the component under test moves the
absorption a level down. Switch the plugin off for the run.
