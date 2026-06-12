# Read-connection arcs in grouped (stacked) mode — build plan

## Status

Proposal, targeted for build. Restores paired-end **read-connection arcs** and
the **read-cloud (samplot)** variant inside in-track grouped mode, where they are
a v1 scope cut today (drawn only when there is a single section). Companion to
`GROUP_BY_PLAN.md` / `GROUP_BY_HANDOFF.md`.

## Goal

When reads are stacked into N group sections, each section draws its own
paired-end arcs / read-cloud lines, in its own band, on a **shared arc Y-domain**
so the sections are visually comparable (a section with larger inserts shows
taller arcs — the same comparability the shared coverage scale already gives).

## Why this is cheaper than it looks

Three facts from the current architecture make this tractable:

- **Arcs are computed on the main thread**, not in the worker
  (`model.arcsComputed` → `computeArcsFromPileupData`, `features/arcs/compute.ts`).
  The worker already partitions reads into groups; `rpcDataMap` is grouped. So
  there is **no worker change** — we compute arcs per group from data we already
  have, instead of only from the primary group (`primaryRawDataMap`, `model.ts`
  ~960).
- **Arcs are independent of chain mode.** `readConnections` (`'arc'|'samplot'`)
  is a separate toggle from `linkedReads` (`'off'|'normal'`). Grouping × chain
  mode stays disallowed (unchanged v1 cut); grouping × arcs only needs
  `linkedReads === 'off'`, which is the normal case for paired-end arcs.
- **The arc Y-domain is already a per-display scalar.** `arcsYDomainBp`
  (`model.ts` ~1516) is the max `|tlen|` across regions, fed to the shader uniform
  `u.arcsYDomainBp` (`alignmentsUniforms.slang`). Making it span all groups (not
  just the primary) is the *same* shared-domain trick coverage uses with
  `coverageMaxDepth`. The shader needs **no change**.
- **Paired-end GPU arcs are non-interactive** (per `LinearAlignmentsDisplay/
  CLAUDE.md`), so this phase needs **no hit-test work**.

## Scope

In scope: paired-end arcs + read cloud (`readConnections: 'arc' | 'samplot'`) —
the "Show read arcs" / "Show read cloud" menu items.

Phased-in: **sashimi arcs** (`showSashimiArcs`, a React SVG overlay) get a later
phase — they live in their own band and are interactive, so they need the
section loop in `SashimiArcsOverlay.tsx` + `computeSashimiArcs`.

Out of scope (deferred): **linked-read bezier overlay**
(`showBezierConnections`, `PileupBezierOverlay`) — it spans the pileup and pairs
with the chain layout; grouping × linked-reads is still disallowed, so leave it
off in grouped mode.

## The load-bearing invariant (must not break)

Ungrouped (single-section) rendering must stay **byte-identical**. Today the arc
band comes from `computeArcBand(state)` (`rendererTypes.ts` ~161) gated on
`state.sections.length === 1` (`GpuAlignmentsRenderer.ts` ~531,
`Canvas2DAlignmentsRenderer.ts` ~312). After this work, the single-section path
must produce the same band + same arc pixels. Guarded by the `AlignmentArcs`
image-snapshot suite (6 tests) — keep it green at every phase.

## Staged build (each stage shippable)

### Stage 1 — Per-group arc data + shared Y-domain (model only, no visual change)

Today: `arcsComputed` runs `computeArcsFromPileupData(primaryRawDataMap, …)` —
group 0 only. `arcsRpcDataMap: Map<regionIdx, ArcsUploadData>` is the per-region
upload feed; renderers upload it under `sectionRegionKey(0, regionIdx)`.

Change:

- Add `arcsByGroup`: for each group key, run `computeArcsFromPileupData` over that
  group's raw data (`laidOutByGroup`'s raw inputs / a per-group `rawDataMap`).
  Reuse the existing per-refName grouping + region-info plumbing per group.
- `arcsYDomainBp` becomes the **max across all groups'** arc data (was: across the
  primary group only). One shared scalar → all sections comparable.
- Keep a primary-group `arcsRpcDataMap` getter as the ungrouped feed so Stage 1
  ships with **zero** visual change (ungrouped = group 0 = today; grouped still
  draws no arcs because the renderer gate is unchanged).

Cost note: per-group arc compute is ~the same total work as one pass (it
partitions the same paired reads), and it is memoized in a getter keyed off
`rpcDataMap` + arc settings (tier-3, no refetch). Don't put any of this in
`rpcProps`.

Ship gate: ungrouped unchanged; `AlignmentArcs` + `AlignmentStack` green.

### Stage 2 — Per-section band layout (geometry)

This is the structural crux. Today two parallel band stacks exist:
`belowCoverageBands` (`model.ts` ~1137: coverage → arc → sashimi → pileup, the
single-section stack) and `computeStackedSections` (`sectionLayout.ts` ~38, which
**pins arc/sashimi bands to 0**).

- Extract the band-stack math from `belowCoverageBands` into a pure helper
  `computeBandStack({ coverageHeight, hasArcsBand, arcsHeight, hasSashimiBand,
  sashimiHeight })` → `{ arcsBandTop, sashimiBandTop, pileupTop }`.
- `belowCoverageBands` calls it (ungrouped — must stay byte-identical; assert via
  existing tests + a unit test on the helper).
- `computeStackedSections` calls it **per section**, so each `Section` reserves
  its own arc band (down mode) / sashimi band, and `pileupTop` is pushed down
  accordingly. The `Section` type already carries `arcBandTop` / `arcBandHeight`
  / `sashimiBandTop` (currently stubbed) — populate them for real.
- Up mode (arcs overlay coverage) reserves no extra space (band top = section's
  coverage top); down mode reserves `readConnectionsHeight` per section. Mirror
  `computeArcBand`'s up/down logic exactly.
- `sections.contentHeight` grows by the reserved bands; scroll math
  (`pileupContentHeight`/`scrollableHeight`) already derives from
  `sections.contentHeight`, so it follows for free.

Heights stay **display-global** (`readConnectionsHeight`, `sashimiArcsHeight`
apply to every section's band) — no per-section arc-height setting in v1.

Ship gate: still no arcs drawn in grouped mode (renderer gate unchanged), but
grouped layout now reserves the bands; ungrouped byte-identical.

### Stage 3 — Renderers loop sections for arcs (GPU + Canvas2D)

- Replace `computeArcBand(state)` + `sections.length === 1` gate with a
  **per-section** arc band read from each `Section`'s `arcBandTop/Height` +
  `readConnectionsDown` (the source of truth moves to the section geometry from
  Stage 2). For the single-section case this must reproduce
  `computeArcBand(state)` — verify by keeping the snapshot suite green.
- `sync`/upload (GPU `GpuAlignmentsRenderer.ts` ~431; Canvas2D
  `buildAlignmentsRegionMap` ~209) upload each section's arcs under
  `sectionRegionKey(sectionIdx, regionIdx)`. `AlignmentsSources.arcsRpcDataMap`
  becomes per-section (parallel to how pileup data is already keyed per section).
- `drawArcsPass` (`GpuAlignmentsRenderer.ts` ~686) is called once per section with
  that section's band (scrolled `coverageTop`/`pileupTop` → device-px scissor) +
  the **shared** `state.arcsYDomainBp`. Canvas2D: per-section `ctx.save()` + clip
  + `drawArcs`.
- Arcs scroll with their section (grouped) — apply `scrollTop` to the band top,
  same as coverage in `buildSectionRenders`.

Ship gate: grouped mode draws comparable per-section arcs; ungrouped
byte-identical (`AlignmentArcs` green). Add a grouped-arc image-snapshot test
(group by strand + `setReadConnections('arc')`).

### Stage 4 — Sashimi per section (interactive SVG overlay)

- `SashimiArcsOverlay.tsx` loops `renderSections`, drawing each section's junction
  arcs in its own sashimi band (`sashimiBandTop` from Stage 2, scrolled).
  `computeSashimiArcs` runs per section (sashimi counts already live per-group in
  `data.sashimiCounts`).
- Shared geometry function stays single-source between overlay + `renderSvg.tsx`
  (don't fork the math — `LinearAlignmentsDisplay/CLAUDE.md`).
- Hover/click hit areas resolve to the section under the cursor (reuse the
  Stage-4 group-by `resolveSectionForCanvasY` already in `useAlignmentsBase`).

### Stage 5 — UI / polish

- Re-enable the arc + sashimi **resize handles** in grouped mode
  (`PileupComponent.tsx` ~225/239 currently gate on `!model.isGrouped`); the
  global height resizes every section's band. Position one handle (e.g. on the
  first section) to avoid N redundant handles.
- Samplot **TLEN axis** (`insertSizeTicks`, `InsertSizeAxisHost`): the shared
  Y-domain means one axis is value-correct; render it once at the first section's
  band, or note as a known limitation.
- Consider defaulting arcs **collapsed/off** when first grouping if they prove to
  eat too much vertical space (the plan flagged this) — but since arcs are an
  explicit toggle, prefer respecting the user's `readConnections` setting and not
  surprising them.

## Files (anticipated touch list)

- `LinearAlignmentsDisplay/model.ts` — `arcsByGroup`/per-section `arcsComputed` +
  `arcsRpcDataMap`; `arcsYDomainBp` across all groups; `sections` populates real
  arc/sashimi bands (via the Stage-2 helper).
- `LinearAlignmentsDisplay/sectionLayout.ts` — `computeStackedSections` reserves
  per-section arc/sashimi bands; new `computeBandStack` helper (+ `.test.ts`).
- `renderers/GpuAlignmentsRenderer.ts` / `Canvas2DAlignmentsRenderer.ts` —
  per-section arc upload + draw; drop the `length === 1` gate.
- `renderers/rendererTypes.ts` — `AlignmentsSources.arcsRpcDataMap` per section;
  `computeArcBand` either generalized to take a section or retired in favor of the
  `Section` band fields.
- `components/SashimiArcsOverlay.tsx` + `computeSashimiArcs` (Stage 4).
- `components/PileupComponent.tsx` — re-enable resize handles in grouped mode
  (Stage 5).
- `products/jbrowse-web/src/tests/AlignmentGroupBy.test.tsx` — grouped-arc +
  grouped-samplot image snapshots.

**No worker changes. No shader (`*.slang`) changes** (shared `arcsYDomainBp`
uniform already does the work). Never edit `*.generated.ts`.

## Risk register

- **Byte-identical ungrouped** (highest): every stage keeps the
  single-section path equal to `computeArcBand(state)` geometry. Guarded by the
  `AlignmentArcs` snapshot suite; run it after each stage.
- **Shader Y-domain semantics**: `arcsYLog` is derived from
  `arcsYDomainBp !== undefined` (samplot vs arc mode). Keep that derivation; only
  the *value* (now cross-group max) changes.
- **Down-mode vertical cost**: N sections × arc band can get tall. Mitigated by
  per-section collapse (already exists for pileups) and respecting the toggle.
- **`computeArcBand` retirement**: if we move the source of truth to `Section`
  band fields, double-check the up-mode "overlay coverage" case (top=0,
  height=covH−coverageYOffset) is reproduced per section, including
  `coverageYOffset` (the y-scalebar label offset).
