---
status: Accepted
summary: "The circular view's chords and ribbons are marks on the GPU ladder, drawn through the circle's polar stage. A chord is a link from `x` to `x2`; a ribbon is the dotplot's alignment segment, a span `x1`..`x2` against its mate's `y1`..`y2` with the strand saying which ends pair. Each foot is a position on the unrolled genome axis and a count of slice gaps, so its angle is affine in the two and the scale and the rotation are uniforms: a zoom or a rotation redraws and uploads nothing. One `defineMark` list gives WebGPU, WebGL2 and a Canvas2D rung that traces the same angles; the hit test is geometric, a ribbon's nonzero winding and a chord's distance from its curve, with no pick canvas. Measured in headed Chrome on an Intel UHD 630: the 66,994-ribbon oat circle rotates at 43 ms a frame and recolours in about 120 ms, where a Canvas2D layer took 3-6 s per repaint. Replaces the Canvas2D layer this ADR first recorded the same day"
---

# ADR-177: A chord is a mark under the circle's polar stage

## Status

Accepted (2026-09-26). Amends the rendering consequence of
[ADR-116](adr-116-a-synteny-alignment-is-a-ribbon-on-the-circle.md), whose
displays were "React SVG, drawn on the main thread from features fetched
whole". Takes up [ADR-163](adr-163-a-link-is-a-mark-and-the-arc-plugin-is-gone.md)'s
next consumer ("a chord needs the link to know it is under a polar stage") and
sits beside [ADR-119](adr-119-the-circular-view-is-a-coordinate-stage-over-the-linear-displays.md),
whose rings are a resampling of each display's strip. The first version of this
ADR, earlier the same day, painted the shapes on a Canvas2D layer; the
measurement below retired it before it shipped.

## Context

Every chord and ribbon was a `<path>` with its own observer component. Measured
on a dev server at commit 022a493c1e, headless Chrome: 5,264 liftOver ribbons
blocked the main thread for 3-4 s to commit and 1.7 s to recolour, and the
dotplot tutorial's 66,994 oat homoeolog anchors took 227 s to recolour inside a
348 s mount. The dotplot's menu offers "Open in circular synteny view", so the
stall was one click from a hosted page.

A Canvas2D layer of the same shapes cut that to seconds and no further. Filling
the oat circle's 66,994 ribbons costs 1.8-1.9 s on SwiftShader, 2.4-2.8 s on an
Intel UHD 630 through ANGLE, and 4.8-5.9 s in a headed default Chrome, while
building the paths costs 80-180 ms: the time is the rasteriser's, so caching
paths or batching colours buys nothing. A pick canvas painted the shapes a
second time on every change, and a zoom painted twice per frame. The layer's
premise, that "the circle's counts are within what a 2D canvas fills in a
frame", holds for the tutorial's 487 ribbons (5 ms) and fails for anchor sets
and whole-genome callsets. A WebGL2 draw of the same 66,994 ribbons as
instanced strips took 26 ms.

## Decision

**Chords and ribbons are marks, declared once.** `chordMark` and `ribbonMark`
(`chords/chordMarks.ts`) are plugin-local `MarkShape`s over `chord.slang` and
`ribbon.slang`, bound to each chord display's cell by one `defineMark` list,
`chordLayerMarks`, and drawn through `createMarkBackend`: WebGPU, WebGL2, and a
Canvas2D rung whose painter traces the same angles through the path sink the
SVG side uses.

**The channels are the grammar's, in data space.** A chord is the link mark's
`x` → `x2`. A ribbon is the alignment the dotplot draws as a segment: its span
`x1`..`x2` and its mate's `y1`..`y2`, each in genomic order, with a `strand`
lane saying which ends pair, so a forward alignment joins start to start and a
reverse one twists. Colour is a packed ABGR lane carrying the SV inspector's
dimming in its alpha; the display's opacity and bow are params.

**The polar stage is uniforms.** A foot is a position on the unrolled genome
axis — every slice's bases end to end, a reversed slice counted backwards, an
elided one at its middle (`axisX`) — and the count of slice gaps before it. Its
angle is `x · radiansPerBp + gaps · gapRadians + rotation`, which is the view's
slice layout restated, so the scale and the rotation are three uniforms. The
view's `chordAxis` is rebuilt only when the regions or their elision change
(`elisionMask`, a string, so a zoom that elides nothing new propagates
nothing); each display resolves its features' feet once per fetch
(`ribbonFeet`, `chordFeet`) and fills its lanes per recolour. A zoom or a
rotation writes the frame and no buffer.

**The geometry is a strip, the coverage is measured.** A ribbon instance is one
triangle strip: a cap over each arc and the band between the two curves,
paired at one parameter and grown by the antialiasing ramp's reach across the
band's own normal, not along the pairing, which slides where the curves' speeds
differ. The fragment measures its distance from both curves across the band
and from the rim radially. A chord is a strip along its curve, measured across
it. Both declare `//! coverage: analytic`, so the display draws at one sample,
which the WebGL2 rung now honours as the WebGPU one did.

**The decisions both sides make are the shader's.** `chordStage.slang` exports
the short-way turn, the 2 px floor on a ribbon end and "a chord under a pixel
draws nothing" as generated JS twins; the control point's radius uses `sin`,
outside the emitter, and `chordGeometry.ts` mirrors it.

**The hit test is geometry.** A ribbon covers a point when its boundary's
nonzero winding there is nonzero, the rule the canvas fills it by, so a twisted
ribbon's two lobes both count; `chordHit.test.ts` holds it to node-canvas's
`isPointInPath` over the painter's own path. A chord is hit within 3 px of its
curve. The view asks its chord displays topmost first. No pick canvas.

**`ChordPass` is the canvas's lifecycle.** A `RenderLifecycleMixin` node the
view holds, one cell per chord display in track order, drawn over the whole
canvas like a ring pass. It records the cells it last drew, and a display's
frame publishes `data-display-drawn` once its own current cell is on screen.

**The SVG is the highlight and the export.** On screen `ShapePaths` draws only
the hovered and the selected shape, from the lanes, and the export draws every
shape as a path with its label as its title.

## Measured after

Headed Chrome, Intel UHD 630, WebGL2 (this machine's WebGPU is blocklisted),
dev server:

| circle | ribbons | first paint | recolour | rotation frame | hover |
| --- | ---: | ---: | ---: | ---: | ---: |
| oat homoeologs, 21 chromosomes | 66,994 | 2.9 s | 104-146 ms | 43-46 ms | 16-24 ms |
| hg38/mm39 liftOver, 20 + 20, 100 kb and over | 487 | 4.6 s | ~120 ms | 17-21 ms | 0.3 ms |

The Canvas2D rung draws the tutorial circle in the same frame times as WebGL2,
and on the SKBR3 translocation circle the two rungs agree to 1.2% of chord ink. The tutorial's fetch reads a PIF's coarse tier, the same
rows with the CIGAR folded, which took it from 133 MB to 7.3 MB.

## Alternatives rejected

- **A Canvas2D layer with a pick canvas**, this ADR's first version: the
  numbers above. It also needed a CSS turn and a debounce to rotate at all.
- **Angles in the instance buffer.** The gaps between slices are pixels over a
  changing radius, so every zoom moves every angle: a zoom would rebuild the
  lanes and upload them per frame. Two lanes and an affine scale move that into
  uniforms.
- **A uniform table of regions**, as the link mark places its feet. It caps the
  regions a circle may show (256 there), and the circle's scale needs no table.
- **`linkMark` with a polar mode.** Its curve is a half-ellipse over a baseline,
  not a chord bowing toward the centre, and a mode flag on a shape is what
  SHADER_SHAPE_LIBRARY.md refuses. The chord keeps the link's channel names, so
  an encoding written for one reads for the other.
- **4x MSAA.** On WebGL2 it made the oat circle's rotation frame 146 ms.
- **A ribbon mark in render-core.** One consumer; ADR-040's bar is two.

## Consequences

- A resting chord is not a DOM node. `data-chord-count` counts the records
  drawn on screen and the paths in the export, and a figure's
  `anchor: { chord }` resolves through the model (`chordAnchor.ts`), as before.
- A rotation and a zoom redraw every frame at any count on the GPU rungs. The
  Canvas2D rung repaints per frame too, which at tens of thousands of ribbons
  is seconds; it is the fallback for a browser with no WebGL2.
- Every held row still crosses to the main thread before the view's length
  filter runs; the coarse tier makes those rows small, and a worker-side filter
  stays the next lever for a file whose drawn rows are a small fraction.
- The grammar's coordinate stage is answered twice in this view: the rings
  resample a strip (ADR-119) and the chords place through the scale in their own
  shaders, because a chord crosses the interior, where there is no strip.
