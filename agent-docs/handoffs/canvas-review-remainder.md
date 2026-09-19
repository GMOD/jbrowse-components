---
name: canvas-review-remainder
description: What the 2026-09-14 review of plugins/canvas left after the 2026-09-18 pass landed the attribute group-by scan, a compose-arity lint and three small fixes — the scan RPC is untested end to end and undriven in the app, the compose ceiling is still nested under rather than lifted, and the bin-builder merge was declined a second time. Read before re-reviewing the canvas plugin or proposing a group-by feature.
---

# Canvas review: what is left

Two passes landed: seven findings on 2026-09-14 (`git log --grep 'canvas:'
--since 2026-09-14`) and five more on 2026-09-18 (the four `canvas:` commits
and one `lint:` commit of that day). **Delete this file when the last item
below lands or is filed elsewhere.**

Permanent homes this file points at rather than repeats:

- The group-by machinery every in-track grouping shares —
  `packages/core/src/util/groupKeys.ts`, and display-kit's `groupByMenu.ts`,
  `GroupLabelChips.tsx`, `HiddenGroupsMixin.ts`.
- Why canvas keeps its own packer and the mark display its encoder —
  [ADR-114](../architecture-decision-records/adr-114-canvas-keeps-its-hand-written-packer.md).

## 1. The attribute scan is untested end to end and undriven in the app

The 2026-09-18 pass gave the canvas `GroupByDialog.tsx` the alignments shape:
`GetCanvasGroupByCandidates` (`RenderFeatureDataRPC/executeGetGroupByCandidates.ts`)
downloads the visible blocks under the render fetch's admission and byte
budget and answers the attribute names with each one's distinct values,
capped at `MAX_GROUPS`; the dialog lists them with section counts and captions
the typed one (`attributeGroupingVerdict.ts`). What is pinned: the summarizer,
the verdict text and the dialog against a stubbed scan. What is not:

- `executeGetGroupByCandidates` has no test. `executeMultiRowGetFeatures.test.ts`
  shows the fixture (a mocked `getFeatureAdapterOrThrow`); the cases worth
  pinning are the byte refusal returning the `RegionTooLargeResult` and a
  `jexlFilters` entry keeping a filtered-out value from becoming a section.
- Nobody has opened the dialog in the running app. The Autocomplete's option
  rows, the caption under the box and the progress line during a real scan
  are unseen; `pnpm start` in `products/jbrowse-web`, the volvox GFF track,
  Group by → Attribute.
- The scan enumerates attribute names through `feature.toJSON()`, which on a
  gene serializes its subfeatures too. Fine for the dialog's one scan per
  open, but worth measuring on a dense gene track before anything else reads
  it per fetch.

## 2. The nine-part compose ceiling

`types.compose` in the MST fork is typed for nine model parts. Three displays
nest `BaseDisplay`, `TrackHeightMixin()`, `HeightModeMixin()` and
`MultiRegionDisplayMixin()` as one part to stay under it. The 2026-09-18 pass
made the tenth part fail at the call (`noTenthComposePart` in
`eslint.config.mjs`) instead of as ~150 "property X does not exist" errors
downstream, and declined both ways of lifting the ceiling: absorbing the trio
into `MultiRegionDisplayMixin()` breaks symmetry with `GlobalFetchMixin()`,
which `ArcFetchModel` composes without `BaseDisplay`, and a wrapper compose
adds a fourth name to the generated foundation table. What remains is the
fork itself: lift its overloads past nine
(`~/src/mobx-state-tree/src/types/complex-types/model.ts`), release, and
un-nest the three sites. Colin's step.

## Declined

Three span-proportional bin builders
(`MultiRowClusterFeaturesRPC/buildMultiRowMatrix.ts`,
`plugins/maf/.../buildIdentityMatrix.ts` § `buildSegments`,
`plugins/wiggle/.../getScoreMatrix.ts` § `buildSegments`) were declined for
merging twice, 2026-09-14 and 2026-09-18. The wiggle one apportions by pixel
width, not by share of the total span, and the other two emit different
shapes (bin midpoints the binary search reads vs segments with a column
offset), so a shared loop would be shorter than the adapters around it.

## Checked and fine

Worker output stays absolute uint32 and nothing worker-side canonicalizes a
refName; `rpcProps` and `regionHasData` are views; the fit ladder's probe and
commit agree by construction; the partition-field pin's race and its
termination are pinned by `partitionFieldTransport.test.ts`; the multi-row
display is right not to take `MAX_GROUPS` or `compareGroupKeys` (rows are lanes
in one span buffer, and `compareRowValues` orders any finite number).
