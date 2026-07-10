# Finding: the DisplayChrome early-`return` rule is a React-Compiler bug, not a jsdom artifact

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

- **(a)** the `model.canvasDrawn` read must sit inside a conditional
  **expression** (ternary). That stops the compiler hoisting it to an
  unconditional per-render `const`; it stays inside a memoized block.
- **(b)** that same block must pass `model` as a **whole object** to a child.
  That coarsens the block's memo dependency from `model.canvasDrawn` down to
  `model` **identity**. Coarsening is sound for an immutable object — but mobx
  mutates `canvasDrawn` in place with `model` identity stable, so the block never
  re-evaluates, the read never re-runs (mobx unsubscribes), and stale JSX is
  returned.

Early-`return` fixes it by breaking (a): each literal `return` is its own memo
scope, so the compiler emits `const t2 = …model.canvasDrawn…` unconditionally,
mobx re-subscribes, and the `<div>` memo (dep `t2`) rebuilds. Verified in the
compiled `DisplayChromeInner`: ternary → one memo gated on `[…, model, phase]`;
early-return → `t2`/`t6` hoisted out. Runnable repro:
`plugins/linear-genome-view/src/BaseLinearDisplay/components/MinimalRepro.test.tsx`
(kept in a scratch copy; not committed — one case fails by design). Probe
scripts: `scratchpad/compile.cjs`, `scratchpad/_probe_harness.cjs`.

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

Before considering any repo-wide change, scanned all 1001 tracked `.tsx` files
(`scratchpad/_scan.cjs`) for the source shape (an `observer` returning a ternary
whose branch both reads `ID.<member>` and passes `ID` whole), then compiled every
candidate through the real react-compiler and inspected the emitted memo gates
(`scratchpad/_verify.cjs`) for the true stale signature (a bare-`ID` gate trapping
an `ID.<member>` read that feeds JSX). Result:

- 45 source candidates → 3 with a genuinely coarsened compiled gate
  (`SequenceBody.tsx` `sequence`, `LocationCell.tsx` `session`,
  `VariantConsequenceDataGrid.tsx` `rows`).
- **All 3 are plain `function` components, NOT `observer`s.** The bug can only
  bite an `observer` (a non-observer never subscribes to mobx, so coarsening to
  object identity is harmless — it re-renders on prop change regardless). Their
  ids are also replaced-on-change values / stable actions, not in-place-mutated
  observable scalars. All 3 are false positives.

So **DisplayChrome was the sole real instance**, and it already ships the fixed
early-`return` form guarded by `DisplayChrome.test.tsx`. No other production fix
is warranted, and a repo-wide `compilationMode`/observer opt-out is NOT justified
(it would disable the compiler across a mobx-everything codebase to fix zero live
bugs). If this ever needs re-checking (e.g. after adding observer components with
ternary returns), re-run the two scratchpad scripts. A custom ESLint rule was
considered and rejected: high false-positive rate (the compiled-output check is
what actually discriminates), zero current instances, and DisplayChrome already
has a regression test.
