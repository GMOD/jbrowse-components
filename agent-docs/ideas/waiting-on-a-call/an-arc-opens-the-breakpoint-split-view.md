---
name: an-arc-opens-the-breakpoint-split-view
description: The read-connections band draws a junction with its category, support count and breakend feet, and is the first SV evidence a reader sees, yet clicking an arc does nothing and right-click falls to the browser. Every route into the breakpoint split view starts from a VCF record or one read's detail widget. A click on an arc or an off-screen tick should open the split view at the junction's two ends with the current track copied, the way an SV inspector chord click already does, which needs no context menu and so leaves the `ContextMenuHit` invariant alone.
---

# An arc opens the breakpoint split view

`useAlignmentsBase.ts` drops a click on an arc on purpose and
`hitTestPipeline.ts` returns no context-menu target for one, so the strongest
summary the alignments display draws is a dead end. A reader who spots a
junction in the band has to find a read under it, open its detail widget and
follow the split-view link there. A long read whose evidence is an SA tag and
no mapped mate has no "View mate" item at all, so for ONT and HiFi data the
band is the only place the junction is even named.

## A click, no menu

[arc-band-open-calls](../collections/arc-band-open-calls.md) §"Give an arc's
right-click something to offer" parks the right-click behind two obstacles.
The hit narrows to `{tooltip, highlight}` before the menu builder sees it, and
`ContextMenuHit` requires a `block` and a `genomicPos` that an arc's hit does
not carry, an invariant a class of sort bugs earned. A left click needs
neither. The SV inspector already launches the split view from a chord click
with no menu in between, and an arc is the same object one view over.

What the click does:

- `ArcHit` carries `x1` and `x2` in absolute genomic bp and the support
  count; `TickHit` carries its `bp` and the partner refNames. Either becomes
  the `{refName, start, mate}` feature `buildPairedEndMateFeature` already
  makes for the read menu's mate launch, and `launchBreakpointSplitView` takes
  it with `view` set, so the panels copy the current tracks.
- The hit's hover still narrows to `{tooltip, highlight}`; the click reads the
  band hit behind it, which is the cheap fix the collection names.
- A tick whose partner is on another chromosome opens the far side in the
  second panel, which is the "where does this reach" the tick's own geometry
  cannot show.
- The reads the arc counted are highlighted across the panels where the hit
  carries their ids, and by position otherwise.

The right-click menu stays parked. A click covers the one route a reader needs
first, and the menu's items, centre on the mate, copy the junction, can follow
once the item set is decided.

## What it waits on

A product call that an arc is clickable. The collection records that nobody
has made it.
