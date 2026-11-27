---
name: an-arc-click-opens-the-breakpoint-split-view
description: The read-connection band is the first SV evidence a reader sees and no gesture on an arc leads anywhere; a left click could open the split view at the junction, a right-click could offer the mate and the far side, and the hover could name the VCF record that calls it.
---

# An arc click opens the breakpoint split view

The read-connections band computes a junction's category, support and breakend
feet; the split view is where the reads behind a junction are examined; no
route joins them. `useAlignmentsBase.ts` drops a click on an arc on purpose and
`contextMenuTargetForHit` (`hitTestPipeline.ts`) returns no target for one, so
a right-click falls through to the browser's menu. A reader who spots a
junction has to find a read under it and follow that read's "View split
alignments" or "View mate", which opens the read's own junctions rather than
the one the arc counted. The call is whether an arc is clickable at all.

## The left click

A click needs no menu plumbing, and the SV inspector already launches the
split view from a chord click.

- `ArcHit` carries `x1` and `x2` in absolute genomic bp and the support count;
  `TickHit` carries its `bp` and the partner refNames. Either becomes the
  `{refName, start, mate}` feature `buildPairedEndMateFeature` already makes
  for the read menu, and `launchBreakpointSplitView` takes it with `view` set,
  so the panels copy the current tracks.
- The hover keeps its narrow shape; the click reads the band hit behind it.
- A tick whose partner is on another chromosome opens the far side in the
  second panel.

Three things the hit does not carry:

- **Breakend orientation.** Only `CrossRegionArc` holds `p1Dir`/`p2Dir`
  (`features/arcs/arcTypes.ts`); a plain arc has none and a `ComputedLine`
  cannot, since a tick coalesces junctions on one coordinate. The launch needs
  it to turn panels or draw feet, so it is new data on the hit.
- **The junction, for a mate link.** A mate-pair arc's ends are the fragment's
  outer edges, so a launch centred on them lands up to an insert size off.
- **Read ids.** Highlighting the counted reads across the panels works by
  position only.

## The right-click

The fall-through is the right rule while a junction has nothing to offer, but
the hit already resolves "where does this reach": centre on the mate, open the
far side in a new view, copy the junction. Decide the item set first; it is a
product call, not an implementation one. Two things are in the way:

- `ArcMarkHit` narrows the hover to `{tooltip, highlight}` and drops the
  `ArcBandHit` behind them, so the coordinates do not reach the menu builder.
  Cheap to fix, and the left click fixes it first.
- `ContextMenuHit` requires `block` and `genomicPos` ("a menu built without one
  was never a real state", which the split-state sort bugs earned). An arc's
  hit carries its region index, not a `ResolvedBlock`, so either arcs get a real
  block or that invariant needs a considered second shape. Don't relax it
  casually.

## The hover names the record that calls it

A reviewer's first question at an arc is whether the caller agrees, and at a
record whether the reads do. When a variant track and an alignments track share
a view, each can answer for the other with a coordinate join over what is
already loaded. This reads the hit plumbing the left click builds.

- An arc's hover adds the VCF record whose two ends fall within a few bases of
  the arc's, printed with the distance at each end, so a near miss reads as one.
  The tolerance is the one number, and the hover prints it.
- A breakend record's hover adds whether the band draws an arc at that
  junction, "no reads" when it draws nothing. **Not its support count**: a
  mate-pair arc merges only on exact coordinates, so its `support` is 1 for
  nearly every pair, and `DV 23 · band 1` at a real deletion would say the reads
  disagree when they are spread across 23 arcs.
- The split view's variant curve hovers only `A → B`. Print the raw FORMAT
  values with their header descriptions there, as the variant widget's sample
  grid does (`VariantSampleGrid.tsx`), never a normalized "ref/alt": `DR/DV`
  counts reads in Sniffles2, cuteSV and Severus and pairs in DELLY, and `SR` is
  one number in DELLY and `ref,alt` in Manta.
- The SV inspector keeps per-sample values as raw `GT:DR:DV` strings
  (`importAdapters/VcfImport.ts`), so a tumor's `DV` cannot be sorted; numeric
  `sample.FORMAT` columns would make it a column.
- Neither hover changes what is drawn. A record with no arc and an arc with no
  record are the two findings a reviewer wants, each a plain absence in the
  text.
