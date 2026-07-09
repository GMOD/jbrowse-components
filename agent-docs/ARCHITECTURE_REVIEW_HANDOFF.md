# Architecture-review follow-up — handoff

Context: a set of review agents audited `agent-docs/ARCHITECTURE.md` and the
GPU-display fetch/export machinery and produced a findings list (real bugs,
fragilities, doc inaccuracies). This branch (`webgl-poc`) implements the
high-confidence fixes. All changes below are **verified**: `pnpm typecheck`
exit 0, `pnpm lint --fix` clean on every touched file, and the affected jest
suites (176 tests across hic / LDDisplay / variants shared / BaseLinearDisplay
models / featureDensityUtils) all pass. Nothing committed yet — shared worktree,
scope commits to explicit pathspecs.

## Done — code

### #1 (top priority) svgReady staleness for HiC/LD — the "fixes itself" gap

`GlobalDataDisplayMixin.svgReady` gates on `dataLoaded`, which HiC/LD defined as
`rpcData !== null` — **presence only, no freshness**. During the post-pan/zoom
debounce+RPC window `rpcData` still holds the pre-move blob (neither fetch clears
it at refetch start — the live canvas deliberately repositions it via
`renderTransform`), so `svgReady` resolved and off-screen export captured stale
data. This is the exact gap the doc claimed `svgReady` closed.

Fix: added pure helper `viewportMatchesLastDrawn(...)` in
`plugins/linear-genome-view/src/BaseLinearDisplay/models/renderTransform.ts`
(re-exported through `BaseLinearDisplay/index.ts` and the plugin `index.ts`).
HiC (`plugins/hic/src/LinearHicDisplay/model.ts`) and LD
(`plugins/variants/src/LDDisplay/shared.ts`) `dataLoaded` now return
`rpcData !== null && viewportMatchesLastDrawn({lastDrawn*, view.offsetPx/bpPerPx})`.
The two fields (`lastDrawnOffsetPx/BpPerPx`) are committed by
`setLastDrawnViewport` immediately after `setRpcData`, so they move together;
exact float equality is correct because we compare a recorded snapshot of the
same observable to its live value — only a genuine viewport change makes them
differ.

- **Design note (user asked):** this is not an escape from reactivity — it's a
  pure derivation read inside the reactive `dataLoaded` getter; mobx still drives
  recompute. The reason we can't just clear `rpcData` at refetch start ("let
  reactivity handle it") is that the **live GPU canvas wants the stale blob**
  (repositioned) during the debounce, while the **SVG export must reject it** —
  two consumers, opposite requirements, same observable. The freshness predicate
  is the global-display analog of the sibling `viewportWithinLoadedData`. User
  was OK with the current shape; flagged a two-field `dataViewport` snapshot
  split as the more reactive-purist alternative if ever wanted.
- Tests: `renderTransform.test.ts` gained a `viewportMatchesLastDrawn` block
  (fresh / stale-pan / stale-zoom / never-drawn).

### #2 test-mode clipPath id that neutered its own guard

`MultiSampleVariantRowColors.tsx` used
`` `row-colors-${typeof jest === 'undefined' ? id : 'test'}` `` — under jest the
id collapsed to the bare literal `row-colors-test`, so two overlays in one
exported doc emit duplicate `<clipPath>` ids and the second renders unclipped —
and `exportAndVerifySvg`'s duplicate-id assertion runs in *exactly* jest, so the
component silently defeated the guard meant to catch it. Fix: route through the
shared `SvgClipRect` with the real `` `row-colors-${id}` `` in all environments
(no snapshot captures this id, verified; the RowColors test uses `getByText`).

### #3 LD hand-rolled the byte verdict

`LDDisplay/shared.ts` re-implemented the floor + `bytes>limit` precedence inline
instead of calling `evaluateRegionTooLarge`. Now composes it (passes resolved
`byteLimit` + `stats.bytes`, no density axis — same "compose the pieces" shape as
canvas), so a future change to the shared precedence reaches LD. Dropped the now
unused `AUTO_FORCE_LOAD_BP` / `bytesTooLargeReason` imports.

### #4 bfcache restore rendering against a disposed HAL

`useRenderingBackend.ts` disposed the backend on `pagehide` but never cleared
`model.currentRenderingBackend` and had no `pageshow` handler — a bfcache
away→back (no unmount) left the upload/render autoruns able to fire against dead
GPU state. Fix: `pagehide` now also calls `model.stopRenderingBackend()` (both
autoruns guard `backend === undefined`, so they no-op) and clears
`rendererRef.current`; added a `pageshow` handler that bumps `contextVersion` on
`e.persisted` so the init effect rebuilds a fresh backend for the still-mounted
canvas. Effect dep changed `[]`→`[model]`.

### #8 resolveByteLimit negative-limit hole

`(adapterFetchSizeLimit || undefined)` let a negative sentinel (`-1`, truthy)
survive and gate every request as too-large. Now `adapterFetchSizeLimit > 0 ? … :
undefined`. Regression test added.

### #6 rpcProps() infinite-loop dev guard (partial, by design)

Added `makeSettingsLoopGuard(name)` in `MultiRegionDisplayMixin.ts`, wired into
the **undelayed** `SettingsInvalidate` autorun. It's a dev-only within-tick
counter that throws a message naming the `rpcProps()` trap when the body re-fires
>50× synchronously — and throwing *before* `clearAllRpcData()` breaks the cycle.
This replaces mobx's cryptic "Reaction doesn't converge". No-op in production.
The **debounced** `installGlobalFetchAutorun` (HiC/LD) loops on the async-fetch
cadence, not synchronously, so a within-tick counter can't distinguish it from
legitimate rapid interaction — documented as a hazard at that call site instead
of adding a false-confidence check.

### Minor: setRenderError churn comment

Added a comment in `RenderLifecycleMixin.setRenderError` explaining the
reference-identity guard (fresh `Error` per throw → cosmetic churn; harmless).

## Done — doc fixes (ARCHITECTURE.md + ADRs)

- **`applyFetchResults` "sums" → `Math.max`** (two spots): code takes the
  per-region max, and the inline code comment already said so.
- **`resolveByteLimit` "0 = no opinion"** → "non-positive" (covers the negative
  sentinel from #8), two spots.
- **`evaluateRegionTooLarge` / LD**: doc now says LD *calls* it (true after #3),
  listed under byte-only composers alongside alignments.
- **"HiC/LD can simply not define rpcProps"** was factually wrong (both define
  it; they compose `GlobalDataDisplayMixin`, not MultiRegion). Replaced the
  example with `LinearReferenceSequenceDisplay` (a real MultiRegion display that
  omits `rpcProps`) and a note steering readers away from HiC/LD.
- **svgReady/dataLoaded**: updated the global-svgReady bullet + the SvgCanvas
  narrow paragraph to describe the new freshness axis.
- **ADR-025 citation**: ARCHITECTURE.md now flags it as superseded by ADR-026
  and states the current invariant (clean dispose-on-unmount, *not*
  mount-lifetime) so the "stays mounted" headline stops reading as a
  contradiction.
- **Stale paths** in adr-025/adr-026: `packages/core/src/util/useRenderingBackend.ts`
  (now a re-export shim) → `packages/render-core/src/useRenderingBackend.ts`;
  `packages/core/src/gpu/RenderLifecycleMixin.ts` (gone) →
  `packages/render-core/src/`.
- **SvgCanvas clip-id carve-out** documented as the one sanctioned exception to
  the "scope clip ids by model.id" rule (module counter, safe, no model in
  scope).
- **TODO.md**: added the dotplot/circular export-freshness gap (the one family
  with no `svgReady`-style freshness gate).

## Not done — deliberately left for a decision

- **#10 DisplayChrome prop/height parity.** Two sub-parts: (a) `{...divProps}`
  spread only on the ready branch, so terminal early-returns drop
  ref/handlers — but that's already documented as benign-by-design in the
  "terminal states early-return their own root" section + ADR-025; (b)
  `TooLargeMessage` renders at intrinsic height while `DisplayRenderErrorOverlay`
  gets `height={model.height}`. Threading height through `TooLargeMessage`→
  `BlockMsg` could churn many displays' too-large snapshots and the intrinsic
  height may be intentional. Needs a product call, not a unilateral change.
- **#5 the early-return-vs-ternary jsdom rule.** ~70 lines of doc + a house-style
  override rest on a mechanism nobody has isolated (all evidence is jsdom +
  `act()`; nothing confirms it in a real browser). Recommendation stands: get a
  Puppeteer `--backend=canvas2d` repro or refutation. If it doesn't repro
  in-browser the fix belongs in the test harness, not production JSX. Keep the
  tests regardless. Did **not** touch the tests or the rule.
- **#7 migrate imperative regionTooLarge (wiggle/alignments/LD) to the derived
  shape**, or document why they can't hit the stuck-banner bug. Bigger refactor;
  out of scope for this pass.
- **#9 make `dataLoaded` a required member** (omission = compile error, not a
  runtime export hang). MST mixin composition doesn't enforce "must override a
  getter" cleanly; riskier change, deferred.

## Files touched

Code: `plugins/linear-genome-view/src/BaseLinearDisplay/models/renderTransform.ts`,
`.../models/MultiRegionDisplayMixin.ts`, `.../models/GlobalDataDisplayMixin.ts`,
`.../BaseLinearDisplay/index.ts`, `plugins/linear-genome-view/src/index.ts`,
`plugins/linear-genome-view/src/shared/featureDensityUtils.ts`,
`plugins/hic/src/LinearHicDisplay/model.ts`,
`plugins/variants/src/LDDisplay/shared.ts`,
`plugins/variants/src/shared/components/MultiSampleVariantRowColors.tsx`,
`packages/render-core/src/useRenderingBackend.ts`,
`packages/render-core/src/RenderLifecycleMixin.ts`.
Tests: `renderTransform.test.ts`, `featureDensityUtils.test.ts`.
Docs: `agent-docs/ARCHITECTURE.md`, `.../adr-025-*.md`, `.../adr-026-*.md`,
`agent-docs/TODO.md`.
