---
name: breakpoint-split-view-and-arc-band
description: The alignments read-connections band and the breakpoint split view each do their half of SV evidence well and neither hands the reader to the other. Five proposals from the 2026-09-26 survey, triaged separately. An arc click opens the split view at its junction; the stacked launch flips the panel an inversion lands on; the launch dialog offers the session's evidence tracks as a remembered checklist; a junction's hover names the callset record within a few bases of it, and a record's hover names the band's support; and a list of small split-view defects, two with a known fix and two that need driving in the app first.
---

# Breakpoint split view and arc band

The read-connections band computes a junction's category, support and breakend
feet and is the first SV evidence a reader sees; the split view is where the
reads behind a junction are examined; and no route joins them. Every path into
the split view starts from a VCF record or one read's detail widget, the panels
open holding whatever the launcher happened to carry, and an inversion draws
crossed. The four entries below are one thread and are triaged one at a time.

## An arc click opens the split view

`useAlignmentsBase.ts` drops a click on an arc on purpose and
`hitTestPipeline.ts` returns no context-menu target for one. A reader who spots
a junction in the band has to find a read under it and follow that read's
"View split alignments" or "View mate" item, which opens the read's own
junctions rather than the one the arc counted.

The gesture is a left click.
[arc-band-open-calls](arc-band-open-calls.md) §"Give an arc's right-click
something to offer" parks the right-click behind two obstacles: the hit narrows
to `{tooltip, highlight}` before the menu builder sees it, and `ContextMenuHit`
requires a `block` and a `genomicPos` an arc's hit does not carry, an invariant
a class of sort bugs earned. A click needs neither, and the SV inspector already
launches the split view from a chord click with no menu between.

- `ArcHit` carries `x1` and `x2` in absolute genomic bp and the support count;
  `TickHit` carries its `bp` and the partner refNames. Either becomes the
  `{refName, start, mate}` feature `buildPairedEndMateFeature` already makes
  for the read menu, and `launchBreakpointSplitView` takes it with `view` set,
  so the panels copy the current tracks.
- The hover keeps its narrow shape; the click reads the band hit behind it,
  which is the cheap fix the collection names.
- A tick whose partner is on another chromosome opens the far side in the
  second panel.
- The reads the arc counted are highlighted across the panels where the hit
  carries their ids, and by position otherwise.

Waits on a product call that an arc is clickable; the collection records that
nobody has made it. The right-click's items, centre on the mate and copy the
junction, can follow once the item set is decided.

## The stacked launch flips the panel an inversion lands on

`navToSingleLevelBreak.ts` decides, per end, whether a panel is turned. The end
keeping the sequence to its right is reversed on the left, the end keeping its
left is reversed on the right (`panelIsTurned`). `navToMultiLevelBreak.ts`
builds the stacked panels, the shape every launch defaults to and the only one
the chain walk supports, and never sets `reversed`.

Today an inversion breakend gives two panels of the same chromosome, both
forward, the curve from the upper panel's right half landing in the lower
panel's right half, and the breakend feet pointing the same way, so the
molecule reads right to left through the lower panel. A foldback is the worst
case: `eventStops` leaves ends further apart than the window as two panels, so
a 6 kb fold gives two windows of one chromosome that read against each other.

- Building the stacked panels applies `panelIsTurned` to the second panel of
  each junction, the way the single-row launch does; the first panel stays
  forward so the reader keeps one fixed frame.
- Each panel's submenu gains a Flip entry that calls the panel's own LGV flip
  action, for the other frame or a callset whose brackets are wrong.
- The overlay needs nothing: `placeOnRow` reads the region's `reversed` flag
  and flips the feet with it, and `Variants.test.ts` pins that.

Not the deferred
[straighten-an-inversion-by-reversing-its-span](../waiting-on-a-call/straighten-an-inversion-by-reversing-its-span.md),
which is the synteny view splitting one region in three; this flips one whole
panel, splits nothing and leaves the follow's fallback navigation alone.
[route-as-a-launch-input](../ready/route-as-a-launch-input.md)
draws an inverted segment as a reversed panel, so this is the first piece of
that work. Waits on a call on the default; flip at launch is the
recommendation, since the picture is wrong without it and the Flip entry
restores the other frame in one click.

## The launch dialog offers the session's evidence tracks

`openOrReuseSplitView` fills a new view's panels from the `view` the launch
came from, from the `defaultTrackIds` the SV inspector passes off
`drilldownTracks`, or from nothing. The SV inspector has no source view, so
without the config key its panels are empty; a read's launch copies its own
view, so the panels hold the callset only if the reader had it open; the cgiab
tutorial's workaround is per-panel track menus. The evidence for a junction is
the same short list every time, tumor reads, normal reads, the callset and a
copy-number or BAF track, and the session already holds them.

- The choice dialog gains a track checklist under its options, listing every
  alignment, variant and quantitative track of the launch's assembly open in
  any view of the session plus the `drilldownTracks` the config names, each
  pre-ticked, with the callset the launch came from first.
- The ticked set is remembered in `localStorage` beside the window size.
- A launch with a `view` still copies it and the checklist adds to the copy,
  so "Copy tracks" keeps its meaning.
- Every launch path passes the callset it came from. The variant widget's link
  (`LaunchBreakendPanel.tsx`) passes neither the callset nor a
  `findJunctionsNear`, so it follows no chain; the alignments widget's link
  passes only the read.

Waits on a call on the dialog growing a list. It is already the one place every
launch passes through, and a per-panel menu would be a second place.

## A junction's hover names the record that calls it

A reviewer's first question at an arc is whether the caller agrees, and at a
record whether the reads do. When a variant track and an alignments track
share a view, each can answer for the other with a coordinate join and no
inference.

- An arc's hover adds the VCF record whose two ends fall within a few bases of
  the arc's, printed with the distance at each end, so a near miss reads as
  one. `ArcHit` carries both ends in absolute bp and the variant display's
  features are in the same view, so the lookup is over what is already loaded.
- A breakend record's hover adds the band's support count at that junction,
  and "no reads" when the band draws nothing there.
- Neither hover changes what is drawn. A record with no arc and an arc with no
  record are the two findings a reviewer wants to see, and each is a plain
  absence in the text.

The tolerance is the one number, and the hover prints it. Waits on the arc
click above, which builds the hit plumbing this reads.

## Loose ends

**View as pairs on by default in the panels: declined (2026-10-04).** The split
view already draws every evidence curve between panels, and inside any panel
whose display does not link its own reads. Chain layout on by default would
swap those coloured intra-panel curves for the chain's grey hairline, make
"Show intra-view links" a no-op for reads, grey out sort and soft clipping,
and relayout on every landing, for mates on one row, which the view never
draws as evidence. A fresh track from `openDefaultTracks` is the one place a
default could honestly live, through `setUnit` so the colour swap comes with
it.

Two findings from the same survey were fixed at once and are not here: the
view-menu toggle that also gates variant curves is named for both, and the
cgiab tutorial no longer describes the removed reconstruction.

**The variant widget's link follows no chain.** `LaunchBreakendPanel.tsx`
calls `launchBreakpointSplitView` with no `findJunctionsNear`, so the dialog
opened from the feature detail never offers the chain the same record's
right-click offers. `makeFindJunctionsNear` wants a node holding the track's
`adapterConfig`, which the widget model does not carry; the widget resolves its
track from the feature's `trackId`, or shares the right-click's launcher.

**A read-curve click opens two generic cards.** `alignmentWidgetOpener` in
`overlayUtils.tsx` opens `BreakpointAlignmentsWidget`, a core card and an
attributes card per read. The alignments plugin's own widget has the SA list,
the paired-alignments card and the flags card. One widget hosting the alignments
detail twice is the shape to decide.

**`height` may be a launch key nothing reads.** `model.ts` declares it as the
height of the whole view, `launchInput.test.ts` pins that a launch sets it, and
no component or action in the plugin reads `self.height`; the heights the
layout sums are the panels' own. Verify in the app that a launched `height`
changes nothing, then remove the key under the beta rule of no migrations.

**Variant curves may land on the track's bottom edge.** The survey reported
that variant curves anchor on the track's bottom edge because the display
exposes no `searchFeatureByID`. The variant display is built on the canvas
base, which exposes `searchFeatureByID` and `layoutReady`, so either the report
is wrong or the lookup misses for another reason, a feature id the display's
index does not hold for instance. Drive it before believing either.
