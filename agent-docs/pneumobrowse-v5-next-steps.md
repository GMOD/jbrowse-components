# PneumoBrowse2 v5.0.0 beta — next-agent plan

Handoff for the open issues from
[`pneumobrowse-v5-bugreport-triage.md`](./pneumobrowse-v5-bugreport-triage.md).
Issue #1 (multi-wiggle `xyplot` union error) and #7 (cluster-dialog X) are done.
What remains, in the order I'd tackle it. Each item lists where to start, what's
already known, and how to confirm — so you don't re-derive the triage.

Reporter context: GPU build (WebGPU/Chrome 148/macOS), config at
https://github.com/abjanssen/PneumoBrowse2. Many of these need a real browser
with GPU content — jsdom won't reproduce them. Use the browser-test harness
(`products/jbrowse-web/browser-tests/runner.ts`, `--backend=webgl --debug`).

## Priority 1 — tooltip/mouseover regressions (#3, #5, #6): ONE subsystem

These are three symptoms of the GPU feature-render tooltip path
(`plugins/canvas/src/LinearBasicDisplay`, `RenderFeatureDataRPC`). Fix together.

- **#3 custom `mouseover` jexl ignored (highest impact — silently breaks user
  configs).** Reporter's methylation track has
  `"mouseover": "jexl:qvscore(get(feature,'identificationqv'))"`; v4 showed
  `QV Score: 186`, v5 shows just `m6A`.
  - Tooltip text is now computed in the **worker**:
    `RenderFeatureDataRPC/collectRenderData.ts:163-167` (`featureTooltip()` →
    `readConfigValue(config,'mouseover',feature,jexl)`).
  - **Two hypotheses to test in order:** (a) the user's custom jexl function
    `qvscore` is registered on the main thread but NOT in the worker's jexl
    instance → evaluation throws → falls back to name. Check how plugin jexl
    functions are registered and whether the RenderFeatureDataRPC worker has
    them. (b) the worker feature payload drops the non-standard
    `identificationqv` attribute → `get(feature,'identificationqv')` is
    undefined. Inspect the serialized feature sent from worker.
  - **Confirm** by adding a track with a custom `mouseover` jexl referencing a
    custom function AND a non-standard attribute; log the worker-side
    `featureTooltip` result.
- **#6 gene tooltip now "name - description".** Reporter: hover used to show
  `dnaN`, now `dnaN - DNA polymerase III beta subunit`, config unchanged. Check
  the default `mouseover` slot (`BaseLinearDisplay/models/configSchema.ts:47-52`)
  and the canvas tooltip builder — is description being concatenated, or is the
  on-canvas description label bleeding into the tooltip?
- **#5 two tooltips (glyph + floating name label).** Both the glyph and the
  floating label are hit-test targets calling `model.setHover()`
  (`FeatureComponent.tsx:260-278`, `:321-327`). `featureItemMap`
  (`baseModel.ts:762-780`) prioritizes `SubfeatureInfo`, which has no `tooltip`
  field (`rpcTypes.ts:162-166`) → label resolves a different/empty tooltip.
  Likely fix: label and glyph resolve the same tooltip (or label has none).

Verify the SVG/legacy path's behavior to define the intended result before
changing the GPU path.

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
