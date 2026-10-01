---
name: offscreen-synteny-mates
description: Alignments whose mate lands outside every region the facing view displays, drawn as a mark rather than a ribbon. Read before changing the mate marks, their click, their hover or their SVG export.
kind: spec
---

# Off-screen synteny mates, drawn as something other than a ribbon

A synteny band draws a ribbon only when both ends land on a displayed region.
Without this feature, a peach locus syntenic to a grape contig the facing row
does not show looks identical to a locus syntenic to nothing. The "Off-screen
mates" checkbox (`showOffscreenMates`, on by default) draws those alignments as
marks in a strip at the band edge, labelled with the contig they point at.

`OffscreenMateOverlay` is a second 2D canvas over the level's, with
`pointerEvents: none`. The level's own canvas belongs to the rendering backend
and may be WebGPU, and the ribbon shader spans the full gap between the two axes
by construction, so a part-height mark does not fit the instance format. Do not
approximate a mark with a degenerate ribbon: the full-height vertical band reads
as an alignment to the locus below it.

## Four classes

| class | anchor | mate | why no ribbon | decided | marked on |
| --- | --- | --- | --- | --- | --- |
| **A** | visible query window | no target region reaches it | no second endpoint | worker, per fetch | query axis |
| **B** | no query region reaches it | visible target window | never requested | worker, per fetch | target axis |
| **C** | visible query window | contig the target displays, scrolled off | `overdrawPx` cull | main thread, per repaint | query axis |
| **D** | contig the query displays, scrolled off | visible target window | `overdrawPx` cull | main thread, per repaint | target axis |

- **A** costs nothing to recover: the adapter returns every alignment anchored
  in the query window whatever its mate, and the decorate loop discards those
  whose mate fails `v2RefNames.has(mate.refName)`. The query axis is the top
  view, so which genome is on top decides how much is free. Never quote one
  percentage for the feature; it is a property of the stacking.
- **B** needs the second query on the target axis, see
  [two-axis-synteny-fetch](TWO_AXIS_SYNTENY_FETCH.md).
- A and B are decided by locus, not contig: the worker marks at each projection
  drop site (`markUnplaced`), and the target fetch asks `findRegionEntry`
  against the displayed regions before flipping anything.
  `bidirectionalFetch.test.ts` holds all four classes.
- **C and D cannot be decided in the fetch.** The facing row pans a full
  `syntenyPanBufferPx` without refetching, so a mark decided at fetch time
  would sit beside a ribbon it claims does not exist. `culledRibbonMates`
  restates the `isRibbonCulled` band in the facing axis's cumBp, so one
  comparison decides both and a mark and its ribbon cannot both draw. It reads
  the instances, not the feature lanes: `starts`/`ends` are untrimmed, and
  transparent-CIGAR mode has no single instance per block. The extent on
  `mateAxis` skips a facing row whose band already spans every mate, which is
  the common zoomed-out state.
- **A row's strip is complete if and only if that row was queried.** The upper
  row always is, so A and C are whole. B is never requested and D is requested
  only within the pan buffer, so one fetch holds an arbitrary fraction of it,
  which the tooltip count would then misreport. `laneData` enforces the rule in
  the one place draw, hit test, tooltip count and SVG export all read.
- Marks are placed from `views[level]`, the level's upper row, because the
  lower row's ruler puts every mark at a wrong offset. The two strips sit on
  opposite band edges, which lets one hit test answer for both.

A chain clipped inside a CIGAR gap gets a one-base mate locus, so its click
frames 20kb around it. Marking the unclipped span would frame the whole chain.

## Drawing

- The band is the drawing unit: one call takes every lane. Label rule: a name
  may not share a baseline, or come within a row of one, with a name already
  placed. Between stretches at the same x, the call takes one from each lane
  before a second from either.
- What a strip draws and names is decided by aligned bp, see
  [ADR-138](../architecture-decision-records/adr-138-aligned-bp-ranks-and-gates-the-off-screen-mate-marks.md).
  The hover leads with that sequence off the per-contig `alignedBp` tally, so it
  stays O(contigs) per pointer move.
- The strip is one path, not a fill per mark. The mark colour carries alpha, so
  per-mark fills darken with density until the strip reads as a solid ideogram.
- Marks are the background and the label is the finding, so marks use
  `text.secondary` at 0.35 alpha and labels use it at full strength.
- Marks obey `minAlignmentLength`, and a sub-pixel mark is floored to a visible
  tick.
- Hover and click share `offscreenMateAt`. A mark can stand for a run of anchors
  (`MIN_OFFSCREEN_MATE_WIDTH_PX`), so the click navigates to the union of the
  mate spans under the pointer; picking one anchor arbitrarily sends the same
  mark to different places at different window widths. The span is floored to
  `OFFSCREEN_MATE_NAV_MIN_BP`.
- Hover is the only place the per-band count shows, via `OffscreenMateTooltip`
  through `ComparativeTooltip`. The hit test lives in the level's pointer
  handlers ahead of the ribbon pick and answers only within the strip height,
  tested before any alignment so hover cost is independent of mark count.
  Draw and hit test share `offscreenMateStrips`.
- `SVGOffscreenMates` is one layer per level after every display's ribbons,
  running the same `drawOffscreenMates` through `PaintLayer`, with a `side` per
  axis. The export carries marks whenever the setting is on.

## Click destination

`mateNavDestination` resolves the class, coordinate and locstring before the
click takes anything, so an unresolvable mark leaves the viewport capture and
follow anchor untouched and notifies. `offscreenMateDestination` is the one
resolver the tooltip and click share, and `coord0` becomes 1-based through
`assembleLocString` before display.

- A click never removes a region and raises a snackbar with an **Undo** that
  restores regions, zoom and scroll. With the follow on, the click takes the
  anchor, or the follow re-asserts the row's old position.
  `LinearSyntenyOffscreenMateFollow.test.tsx` holds it.
- A contig the row lacks is appended whole. For a contig the row shows slices
  of, the click adds a slice in the largest gap holding the locus, trimmed so
  two regions of one contig never overlap (`clipLargeBlockToWindow` assumes
  that), beside its neighbour and running its way. A locus no gap holds is shown
  in the slice holding its centre. The gap is chosen by the locus, not the
  framed window, because `navSpan` clamps the window to the contig.
- An aliased region is respelled to the canonical refName in place, keeping
  extent and orientation, because `navTo` compares `displayedRegions` refNames
  raw.
- The scroll class (C, D) navigates with the row's spelling off `pxToBp`, not
  the mark's canonical one, and its staleness test canonicalizes both sides;
  `===` silently did nothing for an alias. It centres the row on the drawn span
  (`mateCumBp`) at the row's zoom, or padded by `OFFSCREEN_MATE_NAV_GROW` where
  the span does not fit, capped at the widest window the row can show. A flight
  goes through `flyToFit`, which widens from the zoom the flight in the air is
  heading to.
- `LinearGenomeView.flyTo` (`flyTo.ts`) plays the Van Wijk arc for the scroll
  class and reads back what it wrote each frame, so Undo, a wheel zoom or a drag
  ends it. The show class is not flown: `showRegions` changes the row's regions,
  so no coordinate space holds both ends. `animationMode` turns it off.
- The arc crosses ~30 fetch buckets (`bucketBpPerPx`) but costs one extra synteny
  RPC, because the 500ms leading-edge debounce absorbs the excursion. Leave
  `RHO` and the `fetchInert` seam alone until a heavier file says otherwise.

<!-- BEGIN GENERATED MEASUREMENT synteny-mate-flight -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm                     | synteny RPCs, same 3.4s window | widest window reached | ms to land |
| ----------------------- | -----------------------------: | --------------------: | ---------: |
| instant jump (centerAt) |                              1 |          0.4Mb (none) |          0 |
| flight (flyToCenter)    |                              2 |               210.7Mb |        992 |

<!-- END GENERATED MEASUREMENT synteny-mate-flight -->

## Cost

<!-- BEGIN GENERATED MEASUREMENT offscreen-mate-overlay -->

_Generated by `pnpm autogen` — edit the source, not this block._

|   marks | hover over ribbons | hover, before | hover in the strip |  one repaint | SVG export layer |
| ------: | -----------------: | ------------: | -----------------: | -----------: | ---------------: |
|   2,767 |           <0.001ms |       0.043ms |            0.022ms |      0.433ms |            90 KB |
|  50,000 |           <0.001ms |        1.34ms |            0.848ms |      2.888ms |         1.303 MB |
| 250,000 |           <0.001ms |       9.061ms |            4.326ms | **17.435ms** |         6.624 MB |

<!-- END GENERATED MEASUREMENT offscreen-mate-overlay -->

Hover is independent of mark count. The repaint column is layout and path
building, not rasterization, and at 250k marks that alone is a frame. If it is
worth attacking, use a per-pixel-column occupancy pass rather than a rect per
alignment; label placement runs off the same rects, which makes that more than a
draw-loop change.

<!-- BEGIN GENERATED MEASUREMENT culled-ribbon-mates -->

_Generated by `pnpm autogen` — edit the source, not this block._

| features | instances | build, per fetch | one repaint | control (no mate lane) | repaint, band covers | hover over ribbons |
| -------: | --------: | ---------------: | ----------: | ---------------------: | -------------------: | -----------------: |
|   10,000 |    30,000 |           0.51ms |      1.03ms |                 0.93ms |                  0ms |                0ms |
|   50,000 |   150,000 |            2.9ms |      8.86ms |                 6.97ms |                  0ms |            0.001ms |
|  100,000 |   300,000 |           4.86ms |     15.04ms |                15.32ms |                  0ms |            0.001ms |
|  250,000 |   750,000 |          12.38ms |     42.07ms |                47.66ms |                  0ms |            0.001ms |
|  500,000 | 1,500,000 |          23.27ms | **166.1ms** |               168.39ms |                  0ms |            0.001ms |

<!-- END GENERATED MEASUREMENT culled-ribbon-mates -->

`build` is the only new work from classes C and D, once per fetch. `repaint` and
`control` track each other, so the per-entry band test costs nothing.

`website/scripts/probe-mate-density.ts` measures what a window keeps and drops
against the live demo.
