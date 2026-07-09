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

## Next steps (not done — ran out of budget)

- **Correct the docs** to name the real cause (React Compiler memoization, real
  in-browser) and drop the "jsdom artifact / unconfirmed" framing: `DisplayChrome.tsx`
  comment (lines ~58-64, 109-113), `ARCHITECTURE.md` §"Terminal states…"
  (esp. §1, §1a "the exact React-internal reason … is unconfirmed"), and the
  `DisplayChrome.test.tsx` header. Keep the rule; add the aggressive
  load-bearing warning the user asked for, now with the *true* reason.
- **Invalidates the handoff's #5 recommendation**: "if it doesn't repro in a
  real browser, move the fix to the test harness." It *does* repro in-browser
  (compiler output is env-independent), so the fix belongs in production JSX
  exactly where it is.
- **Isolate a minimal repro** for a `babel-plugin-react-compiler` bug report.
  Tools ready in scratchpad: `compile.cjs` (runs the real file through babel +
  the compiler plugin to inspect emitted memo blocks / dependency arrays —
  compare the ready-branch `<div>` memo for early-return vs ternary; the ternary
  version almost certainly omits `model.canvasDrawn` from a memo dep). Then file
  upstream (github.com/facebook/react, react-compiler label).
- The earlier scratchpad browser repro (`scratchpad/repro/`) is **void**: its
  webpack babel config omitted `babel-plugin-react-compiler`, so it couldn't
  reproduce the bug (all shapes "passed"). Re-add the plugin to that config if a
  standalone browser repro is wanted for the bug report.
