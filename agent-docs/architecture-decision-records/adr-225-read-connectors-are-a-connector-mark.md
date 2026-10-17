---
status: Accepted
summary: "The alignments display's curved and cross-region read connectors draw through render-core's `connector` mark, a view-spanning cubic whose two ends place through the view's region table at their rows' centres. `buildConnectorFeeds` turns each section's pairs into channels once per relayout, in bp and rows, so a pan rebuilds no feed; both renderers and the SVG export draw it per section, clipped to the pileup band plus its dip reserve. Hover, click and the selection outline go through the mark's hit test and `ArcHoverOverlay`. The control-point rule is the shader's, js-exported, and core's `bezierConnectorPath`, which the breakpoint split view still draws as SVG, computes through it. `PileupBezierOverlay`, its SVG twin and the per-frame projection go"
---

# ADR-225: Read connectors are a connector mark

## Status

Accepted (2026-10-10), grammar move 5 of the 2026-10-10 review of
LinearAlignmentsDisplay. Continues
[ADR-222](adr-222-sashimi-arcs-are-link-marks.md), which ported sashimi off
its SVG overlay and left this one as the display's last.

## Context

The display draws read-pair and split-read connectors two ways. A normal pair
inside one region is the straight-line pass, `LINKED_READ_LINE_MARK`, a
plugin-local GPU shape under the reads. Everything else — an aberrant pair, a
split junction, a pair whose ends lie in two displayed regions, a junction
across segments nothing fetched, a read that maps back over itself — was
`PileupBezierOverlay`: a React SVG layer whose `computePileupBezierArcs`
re-projected every pair to screen px on every pan frame, with its own hover,
thicken and select handlers, and `PileupBezierArcsSvg` repeating the paths for
the export. It draws whenever "Use curved connectors" (`showConnectors`)
is on, and in chain mode for the pairs that cross a region seam.

Measured on the GPU rung this machine's users get (headed Chrome, WebGL2), the
overlay was the whole cost of the setting: about 7.6 ms of main thread per pan
frame at 211 connectors in read mode and about 2 ms at 106 in chain mode, two
DOM attribute writes per connector per frame, while the straight-line pass beside
it cost about 0.1 ms. On Canvas2D the straight-line pass is the larger cost
instead, one antialiased stroke per normal pair; batching those strokes per
color was measured slower in Chrome and Cairo and blends overlaps differently
from the GPU, so it is not pursued.

## Decision

- **A connector is a render-core `connector` instance**
  (`marks/connectorMark.ts`, `shaders/connectorMark.slang`): `x` on the region
  whose payload holds it, `x2` on the region `x2Region` names, each at the
  centre of its row (`row`, `row2`), with `bend` the dip depth or
  `CONNECTOR_BOW`, a stroke `width`, an ABGR `color` with its alpha, and
  `bits` for each end's strand, a split junction's leading end, a straight
  segment, a dash and an arrowhead. The mark spans the view like `link`, and
  the region-table placement both share is the `viewRegion` slang module.
- **The curve is one spelling.** The handle, lift and tangent rule is the
  shader's, `//! js-export`ed; the Canvas2D painter strokes the same cubic, the
  hit test walks its chords, and core's `bezierConnectorPath`, which
  BreakpointSplitView's `AlignmentConnections` still draws as SVG, computes
  through the twin.
- **The feed is layout, never screen.** `buildConnectorFeeds` reads the pairs
  `bezierPairSections` places and classifies each with the overlay's own
  `connectorShape` (straight, dip, maps-back loop, dashed hidden-segment
  junction), so a pan or zoom rebuilds nothing; a height drag rebuilds it, as
  it moved the dips before.
- **One mark per section, after the blocks.** Both renderers draw
  `CONNECTOR_MARK` over the whole canvas from every region's feed, scissored
  to the section's connector band (`SectionRender.connectorClipTop` /
  `connectorClipHeight`: the pileup band and the room it reserves under its
  last row for a dip). The SVG export paints it with the rest of the canvas.
- **The straight-line pass stays** where it is. On the GPU it costs about
  nothing, and it paints under the reads, where a view-spanning mark drawn
  after the blocks would stripe a deep pileup.
- **Gestures go through the mark.** `resolveConnectorHover` asks the mark's
  hit test ahead of the pileup, since a connector paints over the reads it
  joins, and highlights every connector of the hovered read; a click selects
  the read at the nearer end; `selectedConnectorHighlight` outlines the
  selected read's connectors. `ArcHoverOverlay` strokes both, as it does a
  junction's.

## Consequences

- A pan re-projects no connector; `renderState` reads the pan while any
  section has one (`linkRegions`), as it does under the read-connection band.
- Hover and selection stroke over the connector at 0.55 opacity in the theme's
  ink, as arcs and junctions do. The overlay thickened the connector's own
  stroke to 3 px on hover and 5 px when selected.
- The curve is a 48-segment strip on the GPU and an exact `bezierCurveTo` on
  Canvas2D; the two part by under a pixel's sagitta at the dips the band holds.
- The thinnest stroke is 1.5 device px, the floor the link mark keeps for its
  antialiasing ramp (ADR-222). The overlay's 1 CSS px curves read about 1.5x
  heavier at DPR 1 and are unchanged at DPR 2.
- An end places through the displayed region that holds its bp, preferring
  the one its read was fetched in, as the overlay's `makeBpToScreenX` did: a
  long read can run past its region's edge and join in the next.
- A connector with an end in a displayed region past index 255 draws nothing,
  the link mark's table limit.
- `plotOnly` exports now carry the connectors, which are on the canvas.
- A connector still offers no context menu (`contextMenuTargetForHit`), as the
  overlay did not.
- `PileupBezierOverlay`, `PileupBezierArcsSvg`, `SectionBandClip`,
  `pileupBezierArcs.ts`, `computePileupBezierArcs` and `bezierArcKey` go. The
  projection's tests run through the feed and the mark.

## Measured

Production builds of the commits either side of the port, headless Chrome on
hardware WebGL2, a 120-frame pan out and back; the record's notes have the
rest, and `probe-connector-pan-cost.ts` takes it again from any two builds.

<!-- BEGIN GENERATED MEASUREMENT connector-pan-cost -->

_Generated by `pnpm autogen` — edit the source, not this block._

| view                                                             | connectors drawn | before, on | before, off | before, on − off | after, on | after, off | after, on − off | DOM mutations per frame, before | after |
| ---------------------------------------------------------------- | ---------------: | ---------: | ----------: | ---------------: | --------: | ---------: | --------------: | ------------------------------: | ----: |
| HG008-T Illumina 195x, read mode, `chr3:184,709,000-184,723,000` |              211 |     4.03ms |      1.79ms |           2.24ms |    1.64ms |     1.76ms |         -0.12ms |                             428 |     6 |
| HG008-T HiFi 116x, chain mode by split read, same locus          |              106 |     2.94ms |      2.08ms |           0.86ms |    1.87ms |     1.98ms |         -0.11ms |                             218 |     6 |

<!-- END GENERATED MEASUREMENT connector-pan-cost -->

Before the port the overlay wrote two SVG attributes per connector per frame;
after it a pan writes none, and the setting's main-thread cost is noise around
zero. The first sitting, headed on a loaded laptop's Intel UHD 630, read the
same shape at a higher price: +3.97 and +1.79 ms before, −0.02 and +0.09 ms
after, and 7.6 ms before for the Illumina view at higher load, nearly all of it
SVG style, layout and paint. The branch's profile put the connector mark's own
code at about 0.05 ms per frame.

## Verification

Driven in production builds of both sides on WebGL2 and Canvas2D over volvox
`volvox-simple-inv-paired.bam` and the two HG008-T views: connectors in the
same places, shapes, colors and clips, the maps-back loops present, and a
two-region chain view (which found the region fix above). Hover named the
connection and both reads and lit the read; a click selected the nearer read
and kept its connectors outlined.
