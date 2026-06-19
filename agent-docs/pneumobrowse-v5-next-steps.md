# PneumoBrowse2 v5.0.0 beta — next-agent plan

Handoff for the open issues from
[`pneumobrowse-v5-bugreport-triage.md`](./pneumobrowse-v5-bugreport-triage.md).
Issues #1 (multi-wiggle `xyplot` union error), #7 (cluster-dialog X), and the
whole tooltip cluster #3/#5/#6 are done. What remains is #4 (GC content) and #2
(workspaces freeze). Each item lists where to start, what's already known, and
how to confirm — so you don't re-derive the triage.

Reporter context: GPU build (WebGPU/Chrome 148/macOS), config at
https://github.com/abjanssen/PneumoBrowse2. Many of these need a real browser
with GPU content — jsdom won't reproduce them. Use the browser-test harness
(`products/jbrowse-web/browser-tests/runner.ts`, `--backend=webgl --debug`).

## Priority 1 — tooltip/mouseover regressions (#3, #5, #6): FIXED

All three were one root cause: the GPU tooltip path built tooltip text from
`name`/`description`/`type` and never read the `mouseover` slot. They were
already fixed on this branch **after the reporter's tested build** —
commits `7e576348e8` (Jun 17) + `5f14a7f406` (Jun 18). Confirmed by reading the
history, not just the current code:

- **#6 "name - description"** came from the old `buildFeatureTooltip`, which did
  literally `` `${name}${description ? ` - ${description}` : ''}` ``. Replaced by
  `featureTooltip()` reading the `mouseover` slot (default = name only) →
  `dnaN`.
- **#3 custom `mouseover` jexl ignored** — the old builder never read the slot
  at all. Now `collectRenderData.featureTooltip` evaluates the slot with the
  **worker** pluginManager's jexl instance (`pluginManager.jexl`, threaded
  through `executeRenderFeatureData` → `collectRenderData`). The reporter's
  `qvscore` is registered via their `QVScore.js` plugin's `configure()`, and the
  worker calls `.configure()` on all runtime plugins (`rpcWorker.ts:53`), so it
  resolves. The worker also fetches features itself, so non-standard attributes
  like `identificationqv` survive. Both original hypotheses (worker missing the
  jexl fn / dropped attribute) were wrong.
- **#5 two divergent tooltips** — the old glyph handler resolved
  `sub ? (sub.tooltip ?? sub.type) : feature.tooltip` for subfeatures (no
  `tooltip` on `SubfeatureInfo` → fell to `sub.type`), diverging from the
  label. Now both glyph and label use `result.feature.tooltip`
  (`FeatureComponent.tsx:267-274`, `:321-327`) — one tooltip per top-level
  feature.

Regression tests cover the custom/plain/default slot and single-hover-source
behavior (`collectRenderData.test.ts` "tooltip (mouseover slot)").

**Hardening added this round.** `featureTooltip` and `readFeatureLabels`
evaluated user jexl in the worker with no error handling — a throwing custom
`mouseover`/`labels` expression (missing plugin fn, attribute off an absent
feature) would fail the *entire* track render, where the legacy SVG path only
broke that one tooltip (it evaluated lazily on hover). Both now go through
`readConfigValueSafe` (`renderConfig.ts`): tooltip degrades to the feature name,
labels to `undefined`. Test: `collectRenderData.test.ts` "degrades to the
feature name when a custom mouseover jexl throws".

## Priority 2 — GC content stuck on "loading" (#4)

Reporter's `GCContentTrack`/`LinearGCContentTrackDisplay` never renders.
- Adapter logic is fine — all 13 `plugins/gccontent` jest tests pass. The hang
  is in the **GPU wiggle render/stats path**, not the adapter.
- GC content renders via the wiggle display
  (`SharedModelF` composes `linearWiggleDisplayModelFactory`,
  `LinearGCContentDisplay/shared.ts:21-28`; `adapterConfig` wraps the sequence
  adapter in a `GCContentAdapter`, `shared.ts:111-120`).
- **First action:** reproduce in-browser on the GPU build; watch the worker. Does
  `RenderWiggleDataRPC` / the quantitative-stats estimation resolve?
  `GCContentAdapter` advertises `capabilities = ['hasLocalStats']`
  (`GCContentAdapter.ts:17`) — verify the wiggle display's stats path actually
  calls into it and gets a result on this branch. A permanent "loading" = the RPC
  promise never resolves or render never completes; instrument both.
- Ignore the earlier "generic `BaseSequenceAdapter` cast" theory — type-only, not
  a runtime hang.

## Priority 3 — workspaces (dockview) freeze (#2)

Own doc with detailed next steps:
[`workspaces-freeze-investigation.md`](./workspaces-freeze-investigation.md). Not
yet reproduced; the lead is virtualizing the panel view-stack. New data point
from the report: ~25 real genome views + real tracks, reproducible on toggle.
Start by reproducing with the webgl backend + real tracks per the doc.

## Won't-fix / confirm-only

- **#8 Protein3D `TypeError: …reading 'id'`** — external plugin
  (jbrowse-plugin-protein3d v0.4.10), not core. Refer upstream; the 1D view works,
  only the 3D launch path throws.
- **#9 feature-detail column order** — now follows GFF/JSON attribute order (no
  alphabetical sort remains in `BaseFeatureWidget`). Appears intentional; confirm
  with the team, likely no change.

## Also relay to the team (not bugs)

Reporter strongly wants **scroll-zoom enabled by default** and sees no auto-height
scrollbar artifacts (contra an earlier note).
