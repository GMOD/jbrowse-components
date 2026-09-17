---
name: canvas-review-remainder
description: What the 2026-09-14 review of plugins/canvas (cross-read against alignments' group-by) left unbuilt after seven fixes landed — the "Show chevrons" toggle still refetching where "Show outline" no longer does, an attribute group-by dialog that scans nothing, the nine-part compose ceiling both big displays now nest under, and three span-proportional bin builders. Read before re-reviewing the canvas plugin or proposing a group-by feature.
---

# Canvas review: what is left

Seven findings landed on 2026-09-14 (`git log --grep 'canvas:' --since
2026-09-14`, plus the `HiddenGroupsMixin` commit in display-kit); this file is
the remainder, ranked by what a reader notices. **Delete it when the last item
lands or is filed elsewhere.**

Permanent homes this file points at rather than repeats:

- The group-by machinery every in-track grouping shares —
  `packages/core/src/util/groupKeys.ts`, and display-kit's `groupByMenu.ts`,
  `GroupLabelChips.tsx`, `HiddenGroupsMixin.ts`.
- Why canvas keeps its own packer and the mark display its encoder —
  [ADR-114](../architecture-decision-records/adr-114-canvas-keeps-its-hand-written-packer.md).

## 1. "Show chevrons" refetches the track

Track menu → Show... → Show chevrons writes `displayDirectionalChevrons`,
which is a `WORKER_READS` key
(`plugins/canvas/src/RenderFeatureDataRPC/renderConfig.ts`), so the toggle
changes the fetch key and every loaded region refetches. The worker's only use
of the flag is `emitPrimitives.ts` § `emitIntronLines`: it zeroes the
direction lane when chevrons are off. The chevron pass is its own mark off the
line buffer (`marks/featureGlyphMarks.ts`), so the flag can ride in the render
state and skip that pass instead, the way `outlineColor` now rides there
(commit "canvas: resolve the outline color in the render state, not the
worker"). Emit the direction unconditionally; the SVG export reads the same
render state. Around 40 lines; a test beside the outline one in
`RenderFeatureDataRPC/colorClasses.test.ts` § "the theme is not an RPC cache
key" pins that `rpcProps()` does not move.

## 2. The attribute group-by dialog scans nothing

Canvas's `LinearBasicDisplay/components/GroupByDialog.tsx` takes the attribute
as a text field. The alignments tag dialog (its own `GroupByDialog.tsx`) scans the loaded reads, shows
the distinct-value count and refuses a grouping past `MAX_GROUPS`; canvas
relies on the cap firing after the fact and labels the tail "N merged values".
The multi-row display already ships `partitionCandidates` (the attribute names
the loaded features carry) from its worker
(`MultiRowGetFeaturesRPC/packMultiRowFeatures.ts`); the same list off
`RenderFeatureData`, plus a distinct-value count for the typed attribute,
gives the canvas dialog the alignments shape. Around 80 lines, half of it
worker payload.

## 3. The nine-part compose ceiling

`types.compose` in the MST fork is typed for nine model parts.
`LinearCanvasBaseDisplay`, `LinearAlignmentsDisplay` and `LinearMarkDisplay`
now nest
`BaseDisplay`, `TrackHeightMixin()`, `HeightModeMixin()` and
`MultiRegionDisplayMixin()` in an inner compose to stay under it, as
`LinearMultiRowFeatureDisplay` already did with a similar set. Two ways out:
lift the fork's overloads to eleven parts
(`~/src/mobx-state-tree/src/types/complex-types/model.ts`, needs a fork
release), or give display-kit one `lgvDisplayFoundation()` compose that every
LGV display composes as its first part, which is also what ARCHITECTURE.md
already calls the foundation. The tenth part fails as ~150 "property X does
not exist" errors across every consumer, not as a ceiling; the memory
`compose-tenth-part-erases-every-prop` says so.

## 4. Three span-proportional bin builders

`MultiRowClusterFeaturesRPC/buildMultiRowMatrix.ts` (bins by midpoint, cell
budget), `plugins/maf/src/LinearMafClusterIdentityRpc/buildIdentityMatrix.ts`
§ `buildSegments` (column budget, per-region base cap) and
`plugins/wiggle/src/WiggleRPC/getScoreMatrix.ts` § `buildSegments` (pixel
budget) share the loop and differ in the budget. Declined on 2026-09-14
because merging the budgets moves numbers in at least one; a shared
`spanProportionalBins(regions, budget)` with each caller computing its own
budget still removes two copies. About 50 lines moved, into
`packages/tree-sidebar/src/clusterMatrix.ts`, and the clustering goldens
checked.

## Smaller

- `sectionIdsOf` (`LinearBasicDisplay/facet.ts`) runs three or four times
  per layout pass — `sectionAssignment`, `featureGroupSections`,
  `chipShiftOf` twice — where one pass could return the section list and the
  assignment together.
- The cluster dialog says it clustered by `name` when
  `buildMultiRowMatrix` degraded that field to coverage under
  `MAX_CATEGORICAL_VALUES`; the RPC could report the encoding it chose.
- `LinearBasicDisplay/model.ts` § `colorScales` reads the frozen `legend`
  slot with a bare cast; the multi-row display's `resolveConfiguredLegend`
  checks each entry, and the predicate could be shared.

## Checked and fine

Worker output stays absolute uint32 and nothing worker-side canonicalizes a
refName; `rpcProps` and `regionHasData` are views; the fit ladder's probe and
commit agree by construction; the partition-field pin's race and its
termination are pinned by `partitionFieldTransport.test.ts`; the multi-row
display is right not to take `MAX_GROUPS` or `compareGroupKeys` (rows are lanes
in one span buffer, and `compareRowValues` orders any finite number).
