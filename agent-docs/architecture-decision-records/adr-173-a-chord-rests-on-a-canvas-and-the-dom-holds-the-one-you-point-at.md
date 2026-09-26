---
status: Accepted
summary: "The circular view's chords and ribbons rest on one Canvas2D layer the size of the view's box, painted once per change and turned by CSS while a rotation runs; the SVG above it holds only the hovered and the selected shape, and the export still draws every shape as a path. A pick canvas in id colours answers hover and click in one pixel read. One trace per shape feeds an SVG sink and a canvas sink, so the export, the highlight and the canvas cannot disagree about where a ribbon is. Measured before the change on a dev server: 5,264 ribbons committed as React SVG blocked the main thread for three to four seconds and a colour change re-rendered for 1.7 s; 66,994 gene-pair anchors took 227 s to recolour and minutes to mount. After: a paint is the cost of the fills."
---

# ADR-173: A chord rests on a canvas, and the DOM holds the one you point at

## Status

Accepted (2026-09-26). Amends the rendering consequence of
[ADR-116](adr-116-a-synteny-alignment-is-a-ribbon-on-the-circle.md), whose
displays were "React SVG, drawn on the main thread from features fetched
whole", and sits beside [ADR-119](adr-119-the-circular-view-is-a-coordinate-stage-over-the-linear-displays.md),
whose rings are a GPU resampling of each display's strip.

## Context

Every chord and ribbon was a `<path>` with its own observer component and its
own hover state. ADR-116 recorded the consequence as "no LOD tier and no cap:
a million-row alignment will not draw; a chromosome-scale one will", and the
tutorial pre-cut its chain to rows of 100 kb and over because "the circle
draws every row it is given".

Measured on a dev server at commit 022a493c1e, headless Chrome, before this
change:

| circle                                                   | ribbons | what blocked the main thread                     |
| -------------------------------------------------------- | ------: | ------------------------------------------------ |
| hg38/mm39 un-cut liftOver PIF, three chromosomes         |   5,264 | 3–4 s to commit; 1.7 s to recolour               |
| oat homoeolog anchors, 21 chromosomes                    |  66,994 | 227 s to recolour; the mount inside a 348 s stall |

The oat file is the dotplot tutorial's own demo, and the dotplot's menu offers
"Open in circular synteny view", so the stall was one click from a hosted
page. The cost is React reconciling and Chrome painting one DOM path per
record; a canvas fill of the same outline is tens of microseconds.

## Decision

**The resting shapes are painted on a canvas; the DOM holds the highlighted
shape and the export.**

- **One trace, two sinks.** `traceRibbon` and `traceChord` emit a shape's
  outline through a `PathSink` (`chords/pathSink.ts`): `svgPathSink` builds
  the `d` string the export and the highlight paths use, `canvasPathSink`
  drives a 2D context. `ribbonPath` and `chordPath` keep their signatures on
  top of the SVG sink, so every existing geometry test still pins the string.
- **A display answers `shapes`.** `ChordSyntenyDisplay.shapes` is each drawn
  alignment's four angles and resting fill; `ChordVariantDisplay.shapes` is
  each record's two ends and its `color` slot's answer. Both come from the
  pure `ribbonShape` and `chordShape` in `chords/shapes.ts`, which is where
  "an end off the circle drops the shape" now lives. `shapeAlpha` is the
  group opacity the SVG used to carry.
- **`ChordCanvas` paints every chord display of the view** into a canvas the
  size of the view's box, translated to the circle's centre and rotated with
  the figure, under `getPreparedCanvas2D`'s DPR handling. It repaints when the
  shapes, colours, dimming, box or centre change. A rotation arrives per
  frame, so the canvas turns by CSS from the rotation it painted at and
  repaints 150 ms after the last change, which keeps a drag smooth at any
  count and never lets the chords slip against the ruler on the SVG above.
- **A pick canvas answers hover and click.** `ChordPicker` paints every shape
  once more in an id colour, at most 2048 px across, in the figure's own
  frame. A hit reads the 3×3 pixels under the point, takes the ids there as
  candidates, and confirms each against the shape's own outline with
  `isPointInPath` or `isPointInStroke` under the identity transform, since
  browsers take that point in device space and node-canvas takes it in user
  space. A chord's stroke answers within 6 px where it draws 1.
- **The view routes the pointer.** A move off every ring asks `chordAt`, which
  un-rotates the offset from the centre and hands it to the hit test the
  canvas registered on the model. The answer is `chordHover`, which each
  display's `hoveredFeatureId` reads, the highlight paths draw, and a
  `ComparativeTooltip` shows at the pointer with the display's `shapeLabel`.
  A click calls the display's `clickFeature`. The native `<title>` tooltip is
  gone from the screen; it stays on the export's paths.
- **`ShapePaths` is the SVG side, in two modes.** On screen it draws only the
  hovered and the selected shape, with `pointer-events: none`, under the
  display's testid and a `data-chord-count`. For the export it draws every
  shape, dimmed where the SV inspector's highlighted set says so, each with
  its label as its `<title>`. The `chord-<id>` and `ribbon-<id>` testids
  survive on those paths.

## Alternatives rejected

- **Plain `<path>` elements with no per-path component.** Cuts React's share
  and keeps every DOM contract, but Chrome still rasterises tens of thousands
  of alpha-blended Bezier fills on the main thread, and a hover over a bundle
  dirties a region that holds most of them.
- **A ribbon mark on the GPU stack.** The right long-term home, and what the
  synteny view does, but a new shape needs a `.slang`, a packer, a painter and
  a hit test, and the circle's counts are within what a 2D canvas fills in a
  frame.
- **`isPointInPath` over every shape per move.** Linear in the count on every
  pointer move; the pick canvas is one read.
- **A figure-sized canvas rotated by CSS**, as the SVG is. A zoomed circle's
  figure reaches ten thousand CSS px on a side, past what a backing store
  holds, which is why the ring canvases are the view's box too.

## Consequences

- A chord is no longer a DOM node while it rests. Anything that found one by
  `[data-testid^="chord-"]` reads the renderer group's `data-chord-count`
  instead (`specs/sv.ts`, `examplesChecks.ts`,
  `probe-view-launch-surfaces.ts`, `CircularView.test.tsx`), and a figure's
  `anchor: { chord }` resolves through the model (`chordAnchor.ts`): the
  display's `shapePathFor` gives the outline, `chordAt` says whether the
  chord is what is on top there.
- A test that clicked a chord node calls the display's `clickFeature` with the
  feature, which is what the view's routing does (`SVInspector.test.tsx`).
- The tutorial's pre-cut of the liftOver chain is no longer needed: the view's
  `minAlignmentLength` on the hosted un-cut PIF draws the same figure, and the
  rows the filter drops cost a fetch rather than a mount.
- The fetch is now the cost that remains on a large file: every row crosses to
  the main thread before the length filter runs there. A worker-side filter is
  the next lever, not this one.
