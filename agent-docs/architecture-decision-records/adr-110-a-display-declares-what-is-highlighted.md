---
status: Accepted
summary: "A shape declares its ink — the box each instance paints — and render-core derives the hit test from it; a display declares WHICH instances are lit, as `hoverInk` / `selectionInk` / `pinnedInk` / `soloInk` walked through its mark list, and `DisplayChrome` lights them as positioned divs, so a display places no highlight and recomputes no rect. Six overlays that re-derived the painted rect from their own payloads are deleted, canvas's last among them; the pinned list is the third exported guide, the other three are live-session UI; the highlight stays a div, not render state, on the Canvas2D measurement; what is not a per-instance box keeps its own cue"
---

# ADR-110: A display declares what is highlighted

## Status

Accepted (2026-09-09). The third guide derived from a declaration, after the
legend from declared colour scales
([ADR-108](adr-108-a-display-declares-its-colour-scales.md)) and the axis from
a declared value scale
([ADR-109](adr-109-a-display-declares-its-value-scale.md)). Amends
[ADR-106](adr-106-a-display-declares-its-marks.md): `MarkShape` gains `ink`,
and `hitNearest` is no longer a member every shape writes.

## Context

Every shape's `hitNearest` computed the rect it painted for instance `i` and
kept only the nearest point — `MarkHit` carried `index, x, y, distSq` and not
the rect. So the rect was thrown away at the one place that knew it, and each
display that wanted to light a hovered or selected instance recomputed it from
its own payload. A census on 2026-09-09 found the recomputation in five places,
each a separate spelling of one mark's geometry:

| Display | Overlay | Recomputed from |
| --- | --- | --- |
| alignments | `HighlightOverlay.tsx` + `computeHighlightBoxes.ts` (+ test) | `readPositions` / `readYs` through `spanRect`, section tiers by hand |
| multi-row | `MultiRowHoverHighlight.tsx` + `blockScreenRect.ts` (+ test) | the hit's bp span through `spanRect` and `rowBand`, one px wider than the painting |
| variants (cells) | `HoveredCellHighlight` in `VariantComponent.tsx` | the cell's bp span through `snapVariantCellX` and `drawnCellHeightPx` |
| variants (lane) | `HoveredMarkHighlight` in `VariantLaneOverlay.tsx` | plugin-canvas's laid-out item through `spanRect` |
| gwas | `HoverHighlight.tsx` | a screen point the hit carried, `axisPlotBox` for the inset |
| the mark display | none | — the zero baseline: a config-authored display with no hover cue |

Three more the census listed are not that. Canvas's `highlightBoxes.ts` is
the *search* highlight, which the export draws; its `HighlightLayer` boxes a
layout item with its label rows and the hit pad, which is the hit target and
not an instance's ink, and shares one scroll-locked layer with the solo and
search boxes. MAF's MSA highlight was a genomic range a connected MSA view
names, full height, and has since gone: msaview's own genome overlay already
covered the rows. `findRowHover.ts` is a hit test. Dotplot's cue
restrokes a capsule path.

`HighlightOverlay.tsx` also recorded why the box is a DOM element: the
hovered id changes on nearly every mousemove, and a hover in the canvas's
render state repaints the whole pileup on the Canvas2D fallback per move,
which re-rasterizes every base. That measurement stands.

## Decision

- **A shape declares its ink.** `MarkShape.ink(channels, block, frame,
  params, i)` is the rect the painter fills for instance `i`, undefined when
  culled. `shapeHitNearest` derives `hitNearest` from it where a shape
  declares none — `inkOnRect` over the box, `nearestInk` keeping the closest
  — and `defineMark` binds that. `span`, `bar` and variants' `cell` lost
  their hand-written hit walks; the matrix cell, canvas's rect, line and
  arrow, the pileup factory's three pivots and the read shape's segment
  declare `ink` beside the hit test they keep. `Mark.ink` applies the mark's
  gates and clips to its band, so an instance a band clipped away lights
  nothing, the way it answers no hover.
- **`sweepDrawAgainstHit` holds the ink to the painting**: what the painter
  recorded for `i` lies inside `ink(i)`, every edge of `ink(i)` lies within
  `inkSlackPx` (one pixel) of it, and painted-without-ink or
  ink-without-painting is a violation. The sweep then runs its hit clauses
  against whichever hit test the shape resolves to.
- **A display declares which instances are lit.** `highlightHost.ts` in
  display-kit is the structural host `{ hoverInk, selectionInk?, pinnedInk?,
  soloInk?, highlightStyle? }`: rects in the chrome's px with a `strong` flag, derived
  by walking the mark list with `inkOfInstances(marks, blocks, regionOf,
  state, instancesOf)` for the instance set the display names — a read id to
  its exon segments, a chain to its members, a cell to its index, a hit to
  its `(mark, region, instance)`. `ChromeHighlight` places one positioned div
  per rect off the palette's `featureHover` / `featureHoverStrong` /
  `featureSelected`, and `DisplayChromeBase` mounts it beside the axis and
  the legend for any `isHighlightHost`. Only `pinnedInk` reaches
  `renderDisplaySvg`, and see "Kept, and why" for why that one does.
- **The guide is a div.** The Canvas2D measurement above is the reason, and
  it now lives on `ChromeHighlight` rather than in a comment on one
  display's overlay.

Migrated, one commit each: the mark display (gains a hover it never had),
multi-row, alignments (read and chain; the chain's strong shade is the
rect's flag — and on 2026-09-12 its selection box followed, off both
canvases and out of the SVG export, deleting the `flatQuad` pass whose
four quads were built per frame from the selection), variants (cells and the lane, both surfaces through one
getter), gwas (the ring is `highlightStyle: 'ring'` around the point's ink
grown to the ring's radius). The example plugin's `score` shape declares
`ink`, its model answers `hoverInk`, and the developer guides teach that.

## What was restructured beyond the brief

- **`hitNearest` is derived, not written, wherever the ink is a box.** The
  brief offered `ink` as an optional member beside `hitNearest`; the shapes
  pulled the other way. The rect shapes now carry one geometry, and the sweep
  is what says it is the painter's.
- **`point` keeps its own hit test, on a measurement.** The box-derived test
  broke a dense Manhattan cluster: every overlapping glyph's box contains the
  cursor at distance 0 and the tie goes to whichever candidate the index
  answered first, where the nearest CENTRE is the glyph under the cursor.
  `drawAgainstHit.test.ts` pins the two-glyph case. It is the one shape whose
  ink and hit differ, and the reason `hitNearest` stays a member.
- **The variants' lane hover moved too**, though its box is plugin-canvas's
  layout item and not an instance's ink: the host is structural and takes
  rects, and one guide per display beats two.
- **The hit types stay per display.** A `MarkHitInfo`, a `MultiRowHit`, a
  `ManhattanHit` each carry what the tooltip and the details widget read;
  what converged is the walk from an instance to its rect, not the record of
  what was hit. Converging them onto one instance-set field on
  `StoredHoverMixin` was considered and declined: the alignments hover is two
  ids and a section, the variants hover is one of two surfaces, and a field
  that fits both says nothing the tooltip can use.
- **Variants' `rowIndex` channel is `row`**, the vocabulary `span` and `bar`
  use, on both cell shaders. `startEnd` stays an interleaved pair on the two
  shapes whose worker payload, spatial index and cell lookup all address it
  as one array by `2i`; splitting it is a payload change, not a lens change,
  and canvas's `y` / `height` are pixel geometry rather than the value
  channel `y` names elsewhere, so a rename there would not converge anything.

## Consequences

- Deleted: `HighlightOverlay.tsx` (53 lines), `computeHighlightBoxes.ts`
  (161) and its test (84), `MultiRowHoverHighlight.tsx` (26),
  `blockScreenRect.ts` (46) and its test (86), `HoverHighlight.tsx` (54),
  `HoveredCellHighlight` and `HoveredMarkHighlight` (about 90 lines across
  their two files), plus the three hand-written hit walks. Added:
  `readHighlightInk.ts` (the alignments walk, with the section tiers) and
  its test, `hitInstance` in multi-row's hit testing, `markInk.ts`,
  `highlightHost.ts`, `ChromeHighlight.tsx`. Then, on 2026-09-15: canvas's
  `HighlightLayer`, `highlightUtils.ts` and its test, `highlightBoxes.ts`,
  `morphOffsetViews` / `morphOffsetFor` and its test, and the `data` slot on
  `FeatureItemEntry` that only the layer read. Added: `featureHighlightInk.ts`
  and `SvgPinnedHighlight`.
- Two visual changes, both toward the painting: multi-row's box is the
  span's own width rather than one px wider (the border sits outside the div
  already), and a read's box includes the arrowhead it caps.
- A read's hover, a spliced read's segments and a chain's members merge into
  one box per row, so the intron and the gap between mates shade as before.
- The chrome carries `ChromeHighlight` for every display, +943 B plain on
  the web bundle baseline.
- Browser suites read `[data-testid="chrome-hover"]` where they read a
  display's own testid.

## Kept, and why

- **Nothing of canvas's `HighlightLayer`** — it was deleted on 2026-09-15, and
  the four boxes it drew are the host's four lists. `hoverInk` and
  `selectionInk` light one feature each; `pinnedInk` lights the set the reader
  pinned, from a search hit, a right-click highlight or the `highlight=` URL
  param, and `soloInk` the set collected for a solo, dashed, and empty once the
  solo applies because the view then shows those features and nothing else. The
  reason once recorded here for keeping the layer, that the payload carried no
  feature-to-primitive index, was already wrong when it was written:
  `FeatureDataResult` ships `rectFeatureIndices` / `lineFeatureIndices` /
  `arrowFeatureIndices` beside `rectChildOrdinals` / `lineChildOrdinals` /
  `arrowChildOrdinals`, so the missing half was only the inverse, and
  `buildRegionInstanceIndex` builds it on the main thread the first time
  something is lit. Each box is the union of the glyph's ink and the rects its
  labels drew (`mergeBounds`, `placeFeatureLabels`), so it loses the hit pad and
  the hand-measured label overhang and gains the morph for free — it walks
  `renderDataMap`, the interpolated map, rather than the settled layout, which
  is what retired `morphOffsetFor`. Two of this decision's claims bend here,
  on purpose. The seam "a display names instances and nothing about where
  they are" does not hold for a label: labels are DOM text and not marks, so
  the display derives their rects itself and the chrome receives finished
  boxes, and that stays so until a label is a mark. And `soloInk` is one
  display's gesture on the shared host, taken so the layer could go rather
  than survive for one box kind; a second display wanting a kind of its own
  is the signal to make the host take named lists with styles instead.
- **`pinnedInk` is the third exported guide**, and the one exception to "nothing
  reaches `renderDisplaySvg`": a hover and a selection say where the reader's
  pointer was, a pin is what the figure is about. `renderDisplaySvg` draws it
  inside the body's clip and after the body, so it sits over the glyphs, the
  labels and the peptides — the stacking `ChromeHighlight` gets on screen by
  being mounted after the body. `drawHighlightBoxes` and the export's own box
  pass are gone with it, and `highlightBoxColors` moved to core beside
  `hoverBoxStyle`, where the chrome and the export both reach it.
- **Dotplot's restroke, the arc restroke, LD's crosshairs, MAF's connected
  range, the LGV position highlight, `VariantLaneOverlay`'s band**: none is
  a per-instance box.
- **The pileup shapes' bp-containment hit tests**, which answer inside a
  mark's bp span rather than its pixels ([ADR-106](adr-106-a-display-declares-its-marks.md)
  §Rejected); they declare `ink` for the highlight and keep the rule.

## Rejected alternatives

- **Hover as render state, a `condition` on a channel.** GenomeSpy's
  in-shader selection predicate. Declined on the Canvas2D measurement: a
  uniform costs nothing on the GPU and a whole repaint on the fallback, and
  the fallback is where the pileup is slowest.
- **A per-shape `highlight` painter.** A second painter per shape is a
  second spelling of the geometry, which is what this removes.
- **The chrome walking the marks itself.** The chrome cannot know a
  display's instance set — a read id to segments across sections is the
  alignments display's business — and a display that names instances and
  nothing about where they are is the seam that holds.
