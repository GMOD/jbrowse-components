---
name: a-key-for-the-split-view-connectors
description: The breakpoint split view draws its connectors in colours that carry meaning — interchromosomal, long-insert red, the aberrant pair orientations, inverted split — and nothing on screen decodes them. The display's own legend is off by default and lists only what the display drew. What is waiting is where a key goes over an overlay that spans every panel.
---

# A key for the split view's connectors

The breakpoint split view colours a connector by what it is
(`BreakpointSplitView/components/connectionStyle.ts`): a connection between
chromosomes takes `colorInterchrom`; within one chromosome an inverted split
alignment takes `colorSplitReadInversion` and an RL/RR/LL pair its pair colour;
everything else takes `colorLongInsert`, because every connector the view draws
is evidence. The pileup's colours for a concordant pair (`#d3d3d3`, 1.50:1 on
white) and a same-strand split (`#f0b878`, ~1.6:1) are chosen to fade, which is
why the split view does not take them. The words come from alignments-core's
`CONNECTION_LABELS`, which the display's `connectionLabel` also reads.

Nothing on screen says which colour is which. The alignments display's legend
is off by default (`showLegend`), and `bezierConnectionLegendItems` lists only
the connections the display itself drew, which never includes a junction
between panels. The tooltip names the kind of the one connector under the
pointer.

## The call

`SvgColorLegend` is an SVG `<g>`, so one key serves the overlay and the SVG
export. Where it goes is the open question: the overlay spans every panel, so
its top right sits over the first view's zoom controls and its bottom right over
the last view's track content. List
the kinds `AlignmentConnections` drew — the same walk, filtered by
`showIntraviewLinks` and `isDrawnByPileup` — in `CONNECTION_LABELS` order.
