# Plan: a direct regression test for the DisplayChrome terminal-commit hazard

**Audience:** an agent adding test coverage. Self-contained — you shouldn't need
prior context beyond the files cited.

## Background: the bug we are guarding against

`plugins/linear-genome-view/src/BaseLinearDisplay/components/DisplayChrome.tsx`
renders every GPU display's status chrome. The two subtree-replacing terminal
states — `renderError` and `tooLarge` — are emitted as **literal early-`return`
statements**. This shape is load-bearing and counterintuitive; three rules are
documented in the file's header comment and in
`packages/render-core/src/displayPhase.ts`:

- **Rule 1** — terminal UI must be a literal `if (...) return <Banner/>`, NOT a
  branch of a single ternary `return`. Identical element tree, but under
  React 19 + mobx-react + jsdom the ternary form fails to **commit** the banner
  subtree: `TooLargeMessage`'s component body never runs and it never reaches the
  DOM.
- **Rule 1b** — `computeDisplayPhase`'s `loading` argument is a **thunk**,
  evaluated only after the three terminal flags are ruled out. Eager evaluation
  makes the chrome observer track the containing view's churning
  `visibleRegions`/`loadedRegions` during a terminal state, reproducing the same
  non-commit failure even with the early-`return`.
- **Rule 2** — early-`return` also gives the canvas a clean dispose/re-init
  (unmount → `canvasRef(null)` → `backend.dispose()`). Orthogonal to the commit
  bug but part of why the shape can't change.

## The actual gap

| Layer | Current coverage |
| --- | --- |
| Pure precedence + lazy-thunk logic (`computeDisplayPhase`) | **Covered** — `packages/render-core/src/displayPhase.test.ts` asserts precedence and that the `loading` thunk is not called when a terminal flag is set. |
| The React-commit behavior of `DisplayChrome` itself (rules 1/1b) | **NOT covered directly.** There is no `DisplayChrome.test.tsx`. |
| End-to-end symptom | Only `products/jbrowse-web/src/tests/StatsEstimation.test.tsx` catches a rule-1 regression — and only as a **20–60s timeout**, an opaque failure mode in a heavy integration test. |

Goal: a fast, deterministic, **co-located** unit test that fails *loudly and
specifically* the instant rules 1 or 1b are violated — so the guardrail stops
being an integration-test timeout nobody can diagnose.

## Deliverable

`plugins/linear-genome-view/src/BaseLinearDisplay/components/DisplayChrome.test.tsx`

### Test design

Render `DisplayChrome` with a **minimal mock model** (a plain object / small MST
model) satisfying `ChromeModel & RenderLifecycleModel<B>` — you do NOT need a
real GPU backend; pass a `factory` returning a stub `{ dispose(){} }`. The
children render-prop can return a `<canvas data-testid="probe-canvas"/>`.

Assert **commit to the DOM**, not just element identity. The bug is that the
banner element is *returned but never committed*, so testing the returned tree
would pass even when broken. Two robust ways to assert real commit:

- Put an observable side-effect in the banner path (e.g. a spy component the test
  swaps in, or assert text rendered by the real `TooLargeMessage` /
  `DisplayRenderErrorOverlay`) and assert it is **in `document`** via Testing
  Library `findByText` / `getByText`. A timeout/absence = the commit failed.
- For the loading/ready overlay path, assert the canvas probe AND the
  `${testid}-done` suffix behavior (`canvasDrawn` true → `-done` appended).

Cases (one `test()` each — do not number them):

- `tooLarge` phase commits `TooLargeMessage` (its `regionTooLargeReason` text
  reaches the DOM).
- `renderError` phase commits `DisplayRenderErrorOverlay` (retry affordance in
  DOM).
- `error` phase keeps the canvas mounted AND shows `DisplayErrorBar` (overlay,
  not subtree replacement — assert the `probe-canvas` is still present).
- `loading` phase keeps the canvas mounted AND shows the loading overlay.
- `ready` phase: canvas present, no banners; `canvasDrawn:false` → testid is the
  bare base, `canvasDrawn:true` → `${testid}-done`.
- **Phase transition** `tooLarge → ready` (flip `regionTooLarge`/`displayPhase`
  on an observable model and `rerender`/let mobx react): the banner unmounts and
  the canvas mounts. This is the closest unit-level analog to force-load.

### Negative control (prove the test can fail)

A green test that can't catch the regression is worthless. Confirm it bites by
temporarily mutating the production component and watching THIS test fail (then
revert):

- **Rule 1 mutation:** rewrite the two `if (...) return` blocks as a single
  ternary `return phase === 'tooLarge' ? <TooLargeMessage/> : phase === ... ? ... : <div>...</div>`.
  The `tooLarge`/`renderError` commit assertions must fail.
- **Rule 1b mutation:** in a model used by the test, make `displayPhase` compute
  its loading term **eagerly** (call the loading predicate before the terminal
  checks) while reading a churning observable, and drive a re-render. The commit
  assertion must fail.

Record in the test file's header comment that these mutations were verified to
fail the test (so a future reader knows the guardrail is real). Do **not** leave
the mutations in.

> NOTE: the rule-1 mutation may or may not reproduce under jsdom at the unit
> level — the original symptom was observed in the full jbrowse-web integration
> environment. If the unit harness does **not** reproduce the non-commit (test
> stays green under the mutation), that is an important finding: it means the
> commit hazard only manifests with the real view's observable churn, and the
> StatsEstimation integration test remains the only viable guard. In that case,
> pivot the deliverable (see Fallback) and report the negative result rather than
> shipping a test that gives false confidence.

## Fallback if the unit harness can't reproduce the commit hazard

Then the unit test still has value for the **overlay-vs-subtree** and
**`-done` suffix** behaviors (rules are about commit; those assertions are
independent and worth having). Additionally:

- Un-skip and fix the two `test.skip('… on vcf track …')` cases in
  `StatsEstimation.test.tsx` (lines ~53 and ~88) — they exercise the same
  too-large→force-load path on a variant (canvas) display and were left skipped.
  Establish *why* they were skipped first (`git log -S` the skip, or run them and
  read the failure) before assuming they're flaky.
- Add a comment at the top of `StatsEstimation.test.tsx` documenting that it is
  the **load-bearing guard** for the DisplayChrome commit rules, so nobody
  "speeds up CI" by deleting it. Cross-link `DisplayChrome.tsx`'s header.

## How to run

```
pnpm test plugins/linear-genome-view/src/BaseLinearDisplay/components
pnpm test packages/render-core/src/displayPhase.test.ts   # existing pure-logic test
# integration guard (heavy):
pnpm test products/jbrowse-web/src/tests/StatsEstimation.test.tsx
```

Use `npx tsgo --noEmit` (not `tsc`) for the type check.

## Acceptance criteria

- New `DisplayChrome.test.tsx` passes, and its commit assertions were **verified
  to fail** under the rule-1 and rule-1b mutations (or a documented negative
  result + the fallback work landed instead).
- No `any` / no casts beyond what `ChromeModel & RenderLifecycleModel<B>`
  legitimately requires for the mock; prefer a small real MST model over a cast.
- `pnpm lint --cache` clean; `tsgo --noEmit` clean.
- The `DisplayChrome.tsx` header comment is updated to cite the new test
  alongside (or in place of) the StatsEstimation reference.

## Key files

- `plugins/linear-genome-view/src/BaseLinearDisplay/components/DisplayChrome.tsx`
  — the component under test; header comment has the full rule rationale.
- `packages/render-core/src/displayPhase.ts` + `displayPhase.test.ts` — pure
  precedence/laziness logic (already covered; read for the contract).
- `plugins/linear-genome-view/src/BaseLinearDisplay/components/`
  `TooLargeMessage` (in `../../shared/`), `DisplayRenderErrorOverlay`,
  `DisplayErrorBar`, `DisplayLoadingOverlay` — the four terminal/overlay UIs.
- `products/jbrowse-web/src/tests/StatsEstimation.test.tsx` — current implicit
  guard; the two skipped vcf cases.
- `plugins/linear-genome-view/src/BaseLinearDisplay/CLAUDE.md` — fetch-system and
  `loadingOverlayVisible`/`viewportWithinLoadedData` semantics behind the phases.
