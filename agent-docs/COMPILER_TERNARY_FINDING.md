---
name: compiler-ternary-finding
description: Why babel-plugin-react-compiler can stale a MobX read, and the observer patterns that avoid it. Read when writing observer components or debugging stale MobX reads.
---

# Finding: the DisplayChrome early-`return` rule is a React-Compiler bug, not a jsdom artifact

> **RESOLVED for observers.** `DisplayChromeInner` now carries `'use no memo'`,
> so the compiler no longer compiles it — the only compiled `observer` in the
> codebase. With zero compiled observers, this staleness class is structurally
> impossible *for observers*; the early-`return`-vs-ternary sensitivity below is
> neutralized (early-`return` is kept only as a clear pattern). Everything below
> is the historical analysis.
>
> **NOT resolved for custom hooks — see "The general rule" below.** "No compiled
> observers" is not the same as "no compiled code that reads MobX": a
> `use`-prefixed function is a hook, and the compiler *does* compile it even when
> every caller is an inline observer. `useOverlayState`
> (breakpoint-split-view) hit exactly this and shipped a real bug — panning froze
> the overlay connectors in place, zooming threw them millions of px off-screen.

Investigation of deferred item **#5** (the "early-return-vs-ternary jsdom rule").
The rule is **real and load-bearing** — but every doc that describes it
(`ARCHITECTURE.md` §"Terminal states early-return their own root", the
`DisplayChrome.tsx` comment block, `DisplayChrome.test.tsx` header) **mis-states
the cause**. It is *not* "jsdom + React 19 + `act()`" and the React-internal
reason is *not* "unconfirmed". The cause is **`babel-plugin-react-compiler`**
(enabled globally in `babel.config.cjs`), and it is therefore a **real
production-browser effect**, not a test artifact.

## Proof — controlled experiment on the real code

Mutated `DisplayChrome.tsx`'s two `if (phase === …) return` into one ternary
`return`, ran the real co-located `DisplayChrome.test.tsx`. jsdom held constant
in every row; the only variable is the React Compiler:

| Component form | React Compiler | Result |
| --- | --- | --- |
| early-`return` (pristine baseline) | ON | 7/7 pass |
| single ternary `return` | ON | **1 fail** — the `canvasDrawn → -done` flip, deterministic 3/3 runs |
| single ternary `return` | OFF (temporary `'use no memo'` probe) | 7/7 pass |

The failure requires **both** the ternary form **and** the compiler. Since
`jsdom` is constant across all three rows it is *not* the variable. The compiler
emits identical JS for browser builds, so this drops commits in a real browser
too.

Note on the failing case: the `-done` flip test never enters a terminal branch
(`phase` stays `'ready'`; only `model.canvasDrawn` toggles a `data-testid` on the
ready-branch `<div>`). So the ternary-vs-if form of the *sibling* branches
changes whether an **observable update in the surviving branch commits** — a
memoization/dependency-tracking defect, consistent with the React Compiler
caching a JSX block whose dependency set omits the in-place-mutated mobx
observable (`model` keeps stable identity, so a referential-identity memo never
invalidates, and mobx-react never re-tracks `canvasDrawn`).

## Scope — narrow, not codebase-wide

A **minimal** ternary `observer` that reads an observable in the taken branch
**commits fine** under the compiler (verified: plain case, and
render-prop-children + `{...divProps}` spread + fresh-hook-value case both pass).
So this is **not** "every ternary observer drops updates" — the house
"prefer-ternary" style is not broadly unsafe. DisplayChrome has an extra,
**not-yet-isolated** ingredient that trips the compiler (candidates left to test:
three-way `===phase` branches switching on a computed getter; branches returning
heavy `observer` components; the real `useRenderingBackend` hook with effects).

## What is correct right now

- **Production `DisplayChrome.tsx` is pristine** (early-`return`) — the rule
  stays. Do **not** convert to ternary. **No `'use no memo'`** was left anywhere
  (it was a diagnostic probe only, reverted).
- The first commit on this branch (`f78ab59a04`) did **not** touch #5 or the
  early-return docs.

## Re-audit (independent re-run, confirms)

The three-row experiment was reproduced from scratch on the pristine tree:

| Component form | React Compiler | Result |
| --- | --- | --- |
| early-`return` (baseline) | ON | 7/7 pass |
| single ternary `return` | ON | **1 fail** — `canvasDrawn → -done` flip (`DisplayChrome.test.tsx:176`) |
| single ternary + `'use no memo'` | OFF | 7/7 pass |

jsdom constant across all three; only the JSX form and the compiler varied.
Finding stands.

## Done

- **Docs corrected** to name the real cause (React Compiler memoization, real
  in-browser) and drop the "jsdom artifact / unconfirmed" framing: `DisplayChrome.tsx`
  comment block (rule 1) + the inline early-`return` comment, `ARCHITECTURE.md`
  §"Terminal states…" §1/§1a, and the `DisplayChrome.test.tsx` header. Rule kept;
  narrow-scope caveat added (a minimal ternary observer commits fine).

## Minimal repro — FOUND (runtime-confirmed truth table)

Two ingredients are **both** required. Each alone commits; only together do they
drop the flip. Confirmed at runtime (compiler 1.0.0, React 19.2, mobx-react
9.2.2) via a controlled truth table:

| Component (observer, `function Decl(){}` form) | Compiled gate for the read | Runtime |
| --- | --- | --- |
| **(a)+(b)** ternary branch reads `model.canvasDrawn` AND passes `model` whole to a child | `if ($ !== model \|\| $ !== phase)` — **coarse** | **DROPS (bug)** |
| breaks (a): same, but early-`return` instead of ternary | read hoisted to unconditional `const` | commits |
| breaks (a): same, but no conditional at all | read hoisted to unconditional `const` | commits |
| breaks (b): ternary, but child gets `model.other` not `model` whole | `if ($ !== model.canvasDrawn \|\| …)` — **fine** | commits |

- **(a)** the `model.canvasDrawn` read must sit inside a **conditional** so the
  compiler can't hoist it to an unconditional per-render `const` — it stays in a
  memoized block. This is **not** ternary-specific: `&&` short-circuit
  (`{show && <div>{model.x}<Child model={model}/></div>}`) and a **nested**
  ternary inside an otherwise-flat return **both reproduce it** (runtime-verified,
  `scratchpad/AndRepro.test.tsx`). Only a fully unconditional read (early-`return`
  or no conditional at all) is hoisted and safe.
- **(b)** that same block must pass `model` as a **whole object** to a child.
  That coarsens the block's memo dependency from `model.canvasDrawn` down to
  `model` **identity**. Coarsening is sound for an immutable object — but mobx
  mutates `canvasDrawn` in place with `model` identity stable, so the block never
  re-evaluates, the read never re-runs (mobx unsubscribes), and stale JSX is
  returned. Corollary: only a **stable-identity** carrier is at risk (MST
  nodes: `model`/`view`/`display`/`session`…). A plain prop or local recreated
  when its content changes gets a new identity, so the coarse gate fires and it
  is safe — which is why the audit below finds no live bug.

Early-`return` fixes it by breaking (a): each literal `return` is its own memo
scope, so the compiler emits `const t2 = …model.canvasDrawn…` unconditionally,
mobx re-subscribes, and the `<div>` memo (dep `t2`) rebuilds. Verified in the
compiled `DisplayChromeInner`: ternary → one memo gated on `[…, model, phase]`;
early-return → `t2`/`t6` hoisted out. Runnable repro: a scratch
`MinimalRepro.test.tsx` (not committed — one case fails by design), kept next to
`DisplayChrome.test.tsx` in
`plugins/linear-genome-view/src/BaseLinearDisplay/components`. Probe scripts:
`scratchpad/compile.cjs`, `scratchpad/_probe_harness.cjs`.

**Correction to an earlier note in this file:** a first round of probes
("A–F") all *seemed* to commit and suggested "no single ingredient." That was an
artifact — they used the inline `observer(function(){})` form, which the compiler
does **not** optimize (`compiled=false`), so they never exercised the compiled
path. Using the `function Decl(){}; observer(Decl)` form (what DisplayChrome
uses) the truth table above reproduces cleanly.

## Is it a React Compiler bug to report upstream? — NO

Coarsening `model.canvasDrawn` → `model` identity is **sound under the compiler's
contract**: if `model` is immutable (Rules of React: don't mutate props/state),
then stable `model` identity implies stable `model.canvasDrawn`. mobx violates
that by mutating in place. So the compiler is behaving as designed; the fault is
the mobx × compiler impedance mismatch, not a compiler defect. An upstream report
of this minimal repro would be closed as "you're mutating props — use `'use no
memo'`." The times it *works* (fine-grained `.canvasDrawn` tracking) are
**accidental** alignment, not a guarantee — which is the real hazard.

- **Invalidates the handoff's #5 recommendation** ("if it doesn't repro in a real
  browser, move the fix to the test harness"): it *does* repro in-browser
  (compiler output is env-independent), so the early-`return` fix belongs in
  production JSX exactly where it is.

## Codebase prevalence audit — DisplayChrome is the only instance

A first pass scanned only ternary source shapes and was **incomplete** — it
missed the `&&`/nested trigger family entirely. Redone source-shape-independent
(`scratchpad/_audit.cjs`): compile **every** one of the 431 tracked `.tsx`
`observer` files through the real react-compiler and scan the emitted memo gates
directly for the stale signature (a bare-`ID` gate trapping an `ID.<member>` read
that feeds `_jsx`), regardless of whether the source used a ternary, `&&`, or a
nested conditional. Result:

- 431 observer files → **14 coarsened reads**, across `AlignmentsTooltip`
  (`band.*`, `deletions.*`, `classes.*`), `SashimiArcsSvg` (`arcs.map`),
  `DropDownMenu` (`props.children`), `GroupByDialog` (`tagSet.join`),
  `FeatureComponent`/`WiggleTooltip` (`classes.*`), `ExportToWebDialog`
  (`nonPortable.*`).
- **All 14 are benign.** Every coarsened `ID` is a **prop or local recreated on
  change** (`band`/`deletions`/`arcs`/`nonPortable`/`tagSet` — new object/array
  identity when content changes, so the coarse gate fires) or a **non-observable**
  (`classes` from `useStyles`, `props.children`). None is a stable-identity MST
  node mutated in place — the ingredient (b) corollary that makes DisplayChrome
  uniquely vulnerable. Verified by reading each declaration/prop type.

So **DisplayChrome was the sole real instance**, and it already ships the fixed
early-`return` form guarded by `DisplayChrome.test.tsx`. No other production fix
is warranted, and a repo-wide `compilationMode`/observer opt-out is NOT justified
(it would disable the compiler across a mobx-everything codebase to fix zero live
bugs). Re-run `scratchpad/_audit.cjs` after adding `observer` components that read
an MST node's scalar inside a conditional while passing that node whole. A custom
ESLint rule was considered and rejected: only the compiled-output check truly
discriminates (source heuristics both over- and under-match), zero current
instances, and DisplayChrome already has a regression test.

## Real-browser confirmation — the residual gap is now CLOSED

The one claim that had rested on inference ("repros in a real browser") is now
**directly observed**. Built a standalone bundle — repro compiled through the
real `babel.config.cjs` (compiler ON), bundled with esbuild, driven by puppeteer
in headless **Chrome/150** (`scratchpad/_repro/`) — rendering the ternary form
and the early-`return` form side by side, then flipping `canvasDrawn` by in-place
mobx mutation:

```
BEFORE flip: { bug: "pending0", early: "pending0" }
AFTER  flip: { bug: "pending0", early: "DONE0" }   // ternary DROPPED; early-return committed
```

No console errors. So the bug drops updates in a real browser and the
early-`return` fix works there, exactly as the jest/compiled-output analysis
predicted. (The earlier void browser attempt failed only because its bundler
config omitted `babel-plugin-react-compiler`; this one enables it.)

## Prior art — consistent with the ecosystem

This is a known, documented mobx × React-Compiler class, which corroborates the
"not upstreamable, use the escape hatch" verdict:

- LogRocket, *"React Compiler memoization: what actually broke"* — lists **MobX**
  among libraries that "need `'use no memo'` or a wrapper hook for now" (interior
  mutability). https://blog.logrocket.com/react-compiler-memoization-what-actually-broke/
- mobx#4586 — observer components dropped updates after React 19's stricter
  `memo` handling (reordered lists); fixed by disabling the internal `memo`.
  Same root family (React memoization vs mobx interior mutation), different
  surface. https://github.com/mobxjs/mobx/discussions/4586
- mikejohnson.dev, *"Mobx Memoizes Components (You don't need React Compiler)"* —
  argues observer components don't need the compiler since mobx already
  memoizes; supports an observer opt-out posture as reasonable.

None of these documents the specific **memo-dependency coarsening** mechanism
(`model.<scalar>` → `model` identity when the node is passed whole in a
conditional block) — this writeup is more precise than the general advice.

## The general rule (what actually decides safety)

Established by compiling probes with the real babel plugin (`@1.0.0`) and reading
the output. Inside **any** compiled function — component *or* `use`-prefixed hook
— the two shapes are treated differently:

```js
const a = model.someGetter;        // emitted verbatim, re-read every render
                                   // → mobx tracks it → SAFE, invalidates correctly

if ($[0] !== id || $[1] !== model) // memoized on (receiver identity, args)
  t1 = model.someMethod(id);       // MST mutates in place → identity never changes
else t1 = $[2];                    // → PERMANENTLY STALE
```

So the hazard is **not** "the compiler breaks MobX" broadly. It is narrow:

> **A compiled function must not call a model *method* whose return value feeds
> render.** Property/getter reads are safe — the compiler lifts the read itself
> into the dep comparison, so it stays live.

Why the codebase mostly gets away with it:

- **Inline `observer(function(){})` isn't compiled** — the dominant pattern, so
  most MobX reads never reach the compiler at all.
- **Property reads dominate** (`const { views, assembly } = model`), and those
  are safe even when compiled.
- **Setters/actions in hooks are safe**: `model.setHoverState(...)` inside an
  event handler or effect memoizes the *callback identity*, not a value, and the
  call still runs fresh at event time. An audit of all 59 files defining custom
  hooks found 15 calling model methods — 14 are this benign shape.

The one dangerous shape is a method call **during render** returning
observable-derived data. Known instances:

| Site | Status |
| --- | --- |
| `useOverlayState` → `getTrackOverlayData()` | fixed with `'use no memo'` |
| `useVariantCanvasInteraction` → `contextMenuItems()` in JSX | latent, masked: memoized on `[contextMenuCoord, model]`, and `contextMenuCoord` is a fresh `[clientX, clientY]` array per right-click, so it re-evaluates on every menu open. Would stale if that coord ever became stable. |

**Writing a hook that reads MobX?** Prefer passing already-read *values* in, or
keep the read a plain property access. If you must call a model method that reads
observables, add `'use no memo'` (with the
`eslint-disable-next-line react-compiler/react-compiler` above it — the ESLint
plugin `@19.1.0-rc.2` wrongly calls the directive unused; the babel plugin `@1.0.0`
that builds the app really does compile the function).

**Verifying a suspicion takes one command** — compile the file and look for a
`_c(n)` cache around the call:

```js
babel.transformSync(src, { filename, presets: [['@babel/preset-react',{runtime:'automatic'}],'@babel/preset-typescript'], plugins: ['babel-plugin-react-compiler'] })
```

Unit tests **do** run the compiler (`babel.config.cjs`), but only catch this if
they re-render after mutating the observable; the breakpoint bug needed a real
pan/zoom, so its regression guard is a browser test
(`browser-tests/suites/breakpoint-split-view.ts`, "overlay connectors track pan
and zoom").
