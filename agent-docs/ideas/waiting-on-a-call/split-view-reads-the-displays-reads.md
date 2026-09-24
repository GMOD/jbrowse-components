---
name: split-view-reads-the-displays-reads
description: The breakpoint split view fetches its own copy of every read through BreakpointGetFeatures and pairs it with featureMatching.ts, so it draws reads the display filtered out, loses split junctions inside paired libraries, and colours a split junction by its mate's orientation. Reading the display's own laid-out reads fixes all three. Waiting on one call — reads the display hides or never lays out stop drawing their bottom-edge curve.
---

# Split view reads the display's reads

The breakpoint split view runs `BreakpointGetFeatures`
(`plugins/breakpoint-split-view/src/BreakpointGetFeatures/BreakpointGetFeatures.ts`)
on the raw adapter for every alignments track matched across its rows, then
pairs reads by name in `BreakpointSplitView/featureMatching.ts`. The display
already holds those reads, filtered and laid out, and pairs them with
`readGroupConnections` (`packages/alignments-core/src/readGroupConnections.ts`).
Having two copies causes three bugs:

- **Filtered reads draw.** The RPC ignores the display's `filterBy`, so a read
  the pileup dropped still gets a connector, drawn to the track's bottom edge by
  `makeOffscreenLayout` (`getMatchedFeaturesInLayout`, `model.ts`).
- **Split junctions vanish in paired libraries.** `matchedTrackChunks` decides
  paired-vs-split once per track: any PAIRED flag sends the whole track through
  `getBadlyPairedAlignments`, which keeps only discordant pairs. A split read
  inside a concordant pair has no connector at all, and one inside a discordant
  pair is drawn with the mate endpoint rule (3' to 3') rather than the junction's
  (3' to 5'). `readGroupConnections` decides per connection and emits both the
  split junctions and the mate link.
- **A split junction takes its mate's colour.** In a paired track,
  `AlignmentConnections.tsx` colours every same-ref connection by `f1`'s
  `pair_orientation`, including a split junction, whose colour should come from
  its two segments' strands.

## The change

- **Display**: add `readArraysByGroup` (hidden lanes dropped, empty under the
  zoomed-out density tier) and `readLayoutRecord(groupKey, region, idx)` to
  `LinearAlignmentsDisplay`, and rewrite `searchFeatureByID` on top of the
  second.
- **Split view**: group the display's reads by name across rows, keep reads with
  an SA tag or a non-concordant pair, and run `readGroupConnections`. Look rows
  up per render; on click, fetch both full reads through `withFeatureById`.
- **Cleanup**: `BreakpointGetFeatures` shrinks to variant tracks, and
  `keepAlignmentFeature` goes with it. The read half of `featureMatching.ts` goes
  (`getBadlyPairedAlignments`, `getMatchedAlignmentFeatures`, `hasPairedReads`,
  `readChainSegments`, `markHiddenSegments`); `getVariantJunctions` stays.
- **Docs in the same change**: `agent-docs/mechanisms/split-read-chains.md` says
  `featureMatching.ts` holds all four joins and cites `readChainSegments` and
  `markHiddenSegments` there, and the table in
  [sa-hops-in-the-bezier-overlay](sa-hops-in-the-bezier-overlay.md) cites both.
  That idea also records that the bezier overlay copied `markHiddenSegments`'
  clip window, so the replacement has to keep the two windows agreeing.

## The call

A read the display does not lay out stops drawing. Today a read in a hidden lane,
or any read while the display shows the zoomed-out density tier, is still fetched
by the split view and gets a curve to the track's bottom edge. Once the split view
reads the display, such reads draw nothing. Fixing the filtered-reads bug means
exactly this, but the reader loses a mark, so it needs to be chosen explicitly
rather than discovered.
