---
name: breakpoint-split-view-loose-ends
description: Small breakpoint split view defects from the 2026-09-26 SV survey, unfixed. The variant widget's split-view link cannot follow a chain, and a read-curve click opens two generic cards where the alignments detail belongs; both have a known shape. `height` is a launch key no renderer appears to read, and variant curves were reported to land on the track's bottom edge although the canvas base supplies the lookup that would place them; both need driving in the app before they are believed.
---

# Breakpoint split view loose ends

Found while surveying the split view for the SV work of 2026-09-26. Two
findings from the same pass were fixed at once and are not here: the view-menu
toggle that also gates variant curves is now named for both, and the cgiab
tutorial no longer describes the removed reconstruction.

**The variant widget's link follows no chain.** `LaunchBreakendPanel.tsx`
calls `launchBreakpointSplitView` with the feature, the view and a stable id,
and no `findJunctionsNear`, so the dialog opened from the feature detail never
offers the chain the same record's right-click offers. `makeFindJunctionsNear`
wants a node holding the track's `adapterConfig`, which the widget model does
not carry; the fix is the widget resolving its track from the feature's
`trackId` and handing that node over, or the right-click's launcher being
shared with the widget.

**A read-curve click opens two generic cards.** `alignmentWidgetOpener` in
`overlayUtils.tsx` fetches both reads and opens `BreakpointAlignmentsWidget`,
whose detail is a core card and an attributes card per read. The alignments
plugin's own widget shows the SA list, the paired-alignments card and the flags
card, which are what a reader clicking a junction wants. Opening the
alignments widget for the nearer endpoint read loses the pair; opening it twice
loses the "these two" framing. The shape to decide is one widget that hosts
the alignments detail twice.

**`height` may be a launch key nothing reads.** `model.ts` declares it as "the
height of the whole view in pixels", `launchInput.test.ts` pins that a launch
with `height: 900` sets it, and no component or action in the plugin reads
`self.height`; the heights the layout sums are the panels' own. Verify in the
app that a launched `height` changes nothing before removing the key, and
remove it under the beta rule of no migrations.

**Variant curves may land on the track's bottom edge.** The survey reported
that variant junction curves anchor on the variant track's bottom edge because
the display exposes no `searchFeatureByID`. The variant display is built on
the canvas base, which does expose `searchFeatureByID` and `layoutReady`, so
either the report is wrong or the overlay's lookup misses for another reason,
a feature id the display's index does not hold, for instance. Drive it before
believing either.
