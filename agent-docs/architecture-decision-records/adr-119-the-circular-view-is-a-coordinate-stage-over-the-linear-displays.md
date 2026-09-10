---
status: Accepted
summary: "The circular view is a coordinate stage: every linear display draws on it as a ring, unchanged. The view lays its regions along a strip the width of the circumference (a `RegionHost` it publishes as `regionHost`, which `containingHost` answers before the view), the display renders into that strip exactly as into a linear track, and one ring pass resamples the strip's canvas into an annulus in polar coordinates — one Slang module, one Canvas2D twin, and the SVG export warps the display's own export. A pointer over a ring is unwarped to the strip and handed to the display's chrome, so hover, click and the tooltip are the display's own. Measured against a polar twin per shape: the warp draws a 1000 px ring in 4.3 ms on an Intel iGPU where the wedge takes 5.4 ms with straight edges and 6.8 ms with the eight segments a wide bin needs, it is exact at every bin width where the straight wedge misses 14% of the ring at ten bins, and it touches no display"
---

# ADR-119: The circular view is a coordinate stage over the linear displays

## Status

Accepted (2026-09-10). Closes the "fixed coordinate system" gap in
[GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md), whose
coordinates row read "genomic x, fixed; circular and dotplot are displays, not
coordinate systems". Builds on [ADR-116](adr-116-a-synteny-alignment-is-a-ribbon-on-the-circle.md)'s
slice index and multi-assembly circle, and on the mark layer
([ADR-106](adr-106-a-display-declares-its-marks.md)), whose `texture` lens is
what the ring pass samples through.

## Context

The circular view drew two things, both as React SVG on the main thread:
variant chords and synteny ribbons. Everything a linear display could draw —
a bigWig, a feature density, a coverage band — had no way onto the circle, and
the figure people ask for is Circos: rings of quantitative tracks around the
circle with chords and ribbons across it.

The grammar's coordinate stage is a transform of the plane applied after the
marks are drawn in Cartesian space. Two ways to build it: warp the finished
picture, or give every shape a polar twin. The second keeps arcs exact by
construction and needs a `.slang`, a packer, a painter and a hit test per
shape — fifteen shapes in tree, two twins each — and every hit test would have
to learn the annulus. The first touches no shape and holds
`sweepDrawAgainstHit` parity by construction, and its two open questions were
cost and exactness. Both were measured before either was built.

## Decision

**A linear display draws on the circle as a ring, unchanged, and the ring is
a resampling of the strip the display rendered.**

- **The view is a `RegionHost`.** `CircularView` holds a `CircularRingHost`
  (`plugins/circular-view/src/rings/ringHost.ts`), never attached, and
  publishes it as `regionHost`. `containingHost` in `@jbrowse/display-kit`
  answers `view.regionHost ?? view`, and every structural helper in that
  package resolves the host there; the eight sites that cast
  `getContainingView(self) as RegionHost` now call it. The host's axis is the
  circumference unrolled: `width` and `trackWidthPx` are the circumference,
  `offsetPx` is 0, and `staticBlocks` is one content block per drawn slice at
  the slice's arc — `startRadians × radius` — with an elided block per elided
  run and the inter-slice gap left as a gap. A display fetches per slice, keyed
  by `displayedRegionIndex`, and its `renderBlocks`, hit test and export read
  strip pixels off those blocks the way they read a linear view's. Past the
  widest canvas a backing store holds (`maxCanvasCssPx()`) the strip scales
  down, its `bpPerPx` up, and the ring samples the same `[0, 1]`; a zoomed-in
  circle blurs rather than clips.
- **The view inherits the linear genome view's display types.** `ViewType`
  already had `extendedName` and nothing used it. A track shown on the circle
  takes its own display types first — a variant track keeps its chords when its
  config lists `LinearVariantDisplay` before `ChordVariantDisplay` — through
  `pickDisplayForView`'s `preferredDisplayTypes`, and falls to the linear
  display otherwise. A session spec naming `displaySnapshot.type` still picks
  exactly that.
- **The strip is the display's own component, hidden.** `RingStrips` mounts
  each ring display's `RenderingComponent` in a `visibility: hidden` wrapper
  the strip's width and the display's height, under `data-display-id`. The
  display builds its backend, fetches, paints and publishes
  `data-display-drawn` there as it would in a track.
- **The ring pass samples the strip's canvas.** `ringWarp.slang` draws an
  annulus as a 64-segment fan and samples the strip per fragment at
  `(angle / 2π, (outer − r) / band)`, fading both rims over a device pixel
  (`coverage: analytic`, `blend: premultiplied`). `RenderLifecycleMixin`
  gained `paintCount`, bumped on every painted frame, so the host's `ringCells`
  hands the ring a fresh `MarkImage` only when the strip's pixels moved; the
  HAL's `uploadTexture` takes a canvas beside a byte array
  (`copyExternalImageToTexture` on WebGPU, `texImage2D` on WebGL2), and a
  mark's `texture` lens may answer one. A ring canvas is one `RingPass` node
  per eight rings — a pass holds one texture and a canvas's passes are declared
  when its backend is built — and the canvas is the view's box rather than the
  rotated figure, so the shader takes the centre and rotation as uniforms and
  the canvas never outgrows the backing store. The Canvas2D fallback draws the
  strip as rotated slices of two css px of outer arc through the same shape's
  painter; the SVG export renders each ring display's own SVG for its strip
  (plot only, no axis or legend), rasterizes it and warps it through that
  painter into one `<image>` under the ruler and chords.
- **A pointer over a ring goes to the display's chrome.** The view's `<svg>`
  owns the pointer; a move that is not a rotation is unwarped by `ringHit` —
  the ring whose band holds the radius, `x = angle × stripRadius`,
  `y = outer − r` — and `RingPointer` moves the hidden strip so that strip
  point sits under the real cursor, then dispatches a `mousemove` or `click`
  carrying the real client point at the chrome. `DisplayChromeBase` measures
  against its own box, so the hit test reads strip coordinates and the tooltip
  anchors at the cursor; a leave is a `mouseout` bound for the wrapper, which
  is what React derives `onMouseLeave` from.
- **Chords start inside the innermost ring.** Both chord displays read
  `view.chordRadiusPx`, the ruler's radius when the view holds no ring.

## Measured

`plugins/circular-view/benches/ringWarp.bench.ts`, raw WebGL2 and Canvas2D in
headless Chrome, before the implementation existed:

<!-- BEGIN GENERATED MEASUREMENT ring-warp-vs-wedge -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm       |  bins | ms/frame | vs warp | differs from warp | mean alpha error |
| --------- | ----: | -------: | ------: | ----------------: | ---------------: |
| warp      | 5,278 |   4.33ms |   1.00x |                 — |                — |
| control   | 5,278 |   4.02ms |   0.93x |                0% |                0 |
| restrip   | 5,278 |   4.63ms |   1.07x |                0% |                0 |
| wedge1    | 5,278 |   5.43ms |   1.25x |             22.3% |         27.5/255 |
| wedge8    | 5,278 |   6.83ms |   1.58x |             22.3% |         27.5/255 |
| c2d-warp  | 5,278 |   64.9ms |  14.98x |             49.7% |         28.2/255 |
| c2d-wedge | 5,278 |   37.2ms |   8.58x |             59.0% |         41.4/255 |
| warp      |    10 |   2.92ms |   1.00x |                 — |                — |
| control   |    10 |   3.35ms |   1.15x |                0% |                0 |
| restrip   |    10 |   3.58ms |   1.23x |                0% |                0 |
| wedge1    |    10 |   3.02ms |   1.03x |             14.4% |        241.4/255 |
| wedge8    |    10 |   2.77ms |   0.95x |              1.1% |         56.1/255 |
| c2d-warp  |    10 |     59ms |  20.23x |             62.6% |         34.3/255 |
| c2d-wedge |    10 |   1.02ms |   0.35x |              1.0% |         31.2/255 |

<!-- END GENERATED MEASUREMENT ring-warp-vs-wedge -->

The three questions the design had to answer:

- **(a) Per-frame cost at a 1000 px ring with a 300x coverage track.** The
  ring pass is 4.3 ms on an Intel UHD 630 for a 2000-device-px canvas, within
  the control's 7% of a straight-edged wedge per bin at 5.4 ms and ahead of
  the eight-segment wedge at 6.8 ms — and that is the whole of a rotation
  frame, since the strip is a texture and the rotation is a uniform. The strip
  itself costs what the display costs on a linear view of the circumference's
  width, and it repaints only when the display would; re-uploading a repainted
  5278 × 200 strip is 0.3 ms. A wedge per shape pays its instance count on
  every frame. Rings stack: five rings are five annuli of fragments on one
  canvas, not five bounding boxes, which is why the annulus is a fan and not a
  quad.
- **(b) Arc exactness at wide bins.** The warp is exact at every bin width:
  the arc is sampled per pixel. A straight-edged wedge at ten 36-degree bins
  misses 14.4% of the ring at a mean alpha error of 241/255 — its chord sits
  24 px inside the arc — and needs eight segments to come within 1.1%, which
  is the rim antialiasing. The warp's own cost is a resampling: one-pixel bars
  differ from any exact drawing on 22% of pixels at 27/255, the Canvas2D warp
  and the GPU warp differ from each other by the same amount, and an inner
  ring is minified by `inner / ruler`.
- **(c) Per-display code touched.** None. Wiggle, the mark display's density
  and coverage layers and the variant chords beside them ran on the first
  build; the changes are two lines in each chord display's radius, the
  `containingHost` and `containingLgv` routing, and `plotOnly` on the export
  options. The canvas feature display and the alignments pileup read the
  linear genome view itself rather than the host contract, so the strip
  answers the members they draw by — `bpToPx`, `pxToBp`, the coarse blocks,
  `visibleWholeBaseRegions` — and both drew as rings on the second build
  without a line of their own changing. The wedge alternative is a twin per
  shape and a hit test that knows the annulus.

On swiftshader the same per-pixel fixture read warp 29 ms, wedge1 75 ms
(2.56x) and wedge8 218 ms (7.48x); CPU rasterisation prices vertices against
fragments differently, and only the order is read from it.

## Rejected alternatives

- **A polar twin per shape, composed at compile time the way `valueScale` is.**
  Exact arcs need subdivision that scales with angular width, so the vertex
  count is the instance count times a segment count chosen for the widest
  bin; every hit test learns the annulus; fifteen shapes gain a twin, and the
  `sweepDrawAgainstHit` sweep would have to run over each pair. The
  measurement above says it does not win on cost either.
- **The circular view satisfying `RegionHost` itself.** Its `width` is the
  box and the strip's is the circumference, and `renderDisplaySvg` paints at
  `view.width`; one node cannot answer both. The host is a second node the
  view owns.
- **A nested `LinearGenomeView` per ring.** A real view brings its header,
  scalebar and track containers, and a track added to the circle would live
  under the ring's view rather than the circle's `tracks`, which the selector
  and `showTrackGeneric` read.
- **One ring canvas per ring.** Simplest lifecycle, but a WebGL context per
  ring on top of one per strip reaches the browser's context ceiling at eight
  rings. One canvas per eight passes halves the count.
- **Warping the exported SVG's paths.** SVG has no polar transform; every
  path would be re-tessellated per display. The raster is what the screen
  drew.
- **A per-ring strip at the ring's own circumference.** Exact resolution on
  inner rings, but a host per ring: `getContainingView` finds the circular
  view, so the display's host is one per view.

## Consequences

- `containingLgv` answers the strip too, so a display that names the linear
  genome view as its view gets the strip's `bpToPx`, `pxToBp`, coarse blocks
  and whole-base regions, and `false` for `colorByCDS` and `showAminoAcids`.
  A member the strip does not carry — `navTo`, `showTrack`, the chrome
  settings — is `undefined` there, and a display reaching for one in a render
  path is the display that stays off the circle; the alignments pileup's
  sashimi overlay threw on `view.width` before the strip carried it, which is
  how the list above was found.
- Wiggle, mark, canvas, alignments and the other `MultiRegionDisplayMixin`
  displays draw as rings; a display's axis and legend chrome stay in the
  hidden strip. A ring has no y-axis on screen.
- `RenderLifecycleMixin.paintCount` is one more volatile every display
  carries, written per painted frame.
- A mark's `texture` lens answering `undefined` now leaves the pass's texture
  bound rather than swapping in the inert table, and binds the inert table
  only while the pass has none; the ring's eight passes depend on it, and the
  ramp consumers never read a ramp they have not asked for.
- A view whose displays lay out along an axis that is not its box publishes
  `regionHost`; `AbstractViewModel` names the member.
