---
status: Accepted
summary: "Intron chevrons sit at genome positions on a power-of-two bp grid 28–56 px apart, and flatten to fit the box their line runs through (none under 3 px). An intron no grid point lands in gets no chevron; multi-way synteny lanes draw none"
---

# ADR-264: Chevrons sit on a genome grid and fit their box

## Status

Accepted (2026-11-11). Replaces the per-line chevron layout that
[ADR-051](adr-051-shader-js-codegen-is-scalar-only.md)'s table lists as
`showChevrons`, `chevronCount`, `chevronOffset`, `chevronFirstVisible` and
`chevronLastVisible`.

## Context

Each intron line used to spread its own chevrons: `floor(widthPx / 40)` of
them in equal gaps, at a fixed 4 px tall. Two things went wrong in compact
layouts. The isoforms of a gene each started their spread at their own intron
start, so their chevrons never lined up, and a zoom re-spread every line. In
`superCompact` a 4 px chevron in a 3 px row reached into the rows beside it,
and a stack of isoforms read as a zigzag that hid the exons.

## Decision

- **A chevron sits at a genome position that is a multiple of the grid step**,
  `chevronGridBp(bpPerPx)`: the smallest power of two in bp at least
  `CHEVRON_SPACING_PX` (28 px) apart on screen, so neighbours are 28–56 px
  apart, about 40 px on average as before. Every isoform's chevrons fall in
  shared columns, and a zoom past a power of two keeps every chevron and adds
  the ones halfway between. 28 is not a power of two, so no step boundary
  falls on a round bpPerPx such as 0.1 or 1.6, where the GPU's float32
  `log2` would otherwise decide the step.
- **A chevron flattens to fit its box**: `chevronHalfHeightPx(boxHeightPx)` is
  `min(CHEVRON_H_PX, box − thickness) / 2`, and 0 below a 1 px half-height, so
  a box under 3 px gets none. The width stays 4 px so it still reads as an
  arrow. The worker sends each line's box height as `lineHeights`.
- **A chevron keeps its arms and `CHEVRON_END_GAP_PX` (2 px) clear of the
  exons** at either end of its line.
- **An intron that no grid point lands in gets no chevron.** At gene zoom many
  introns under about 56 px lose theirs; every transcript keeps the strand
  arrow at its end.
- **Multi-way synteny lanes draw no chevrons** (`hideChevrons` in
  `multiwayMarks.ts`). A lane positions its genes in px from a layout origin
  that moves on every settled pan, so a bp grid there would hop along the
  introns; every lane gene keeps its strand arrow, and strand rows where the
  lane splits them.

The layout is stated once in `chevron.slang` and js-exported (ADR-051), so the
shader, the Canvas2D painter and the R export (`chevrons`, which gains a
`halfHeight` column) place the same chevrons. `chevronGridWindow`
(`sharedRendererConstants.ts`) walks the grid for the two js consumers.

The offset from a line's start is `phase + k * grid`, an integer times a power
of two, exact in float32 while it stays under 2^24 bp at a 1 bp grid.
`chevronPhaseBp` takes the start's remainder with a bit mask, which is exact
at a 3 Gb start where a float32 modulo is not.

## Consequences

- Introns shorter than about 56 px show strand chevrons only where a grid
  point happens to fall, so neighbouring short introns look irregular.
- `LineData`, `FeatureDataResult` and the multi-way synteny glyph builder carry
  `lineHeights`, and `applyHeightScale`, `cloneMutableFields` and the isoform
  trim keep it in step with the other line fields.
- A line's hover and hit box grows by a chevron's reach only when a grid point
  lands on it.
- ggjbrowse draws chevron arms at the `halfHeight` column (its
  `half_height`) since ggjbrowse ab972d3; `glyph.chevronHeight`
  stays as the unflattened ceiling.
- `chevronGrid.test.ts` pins the grid, the columns, the zoom nesting, the end
  clearance, the window, the slot budget, the phase, the height rule and a
  chevron in every display mode at the default height; `yLanes.test.ts` pins
  `lineHeights` through the height scale and the isoform trim.

## Rejected

- **One chevron for a line no grid point lands in**, at its midpoint or at the
  coarsest power-of-two point inside it. It keeps every intron's strand at the
  cost of a second placement rule; Colin ruled short introns can lose theirs.
- **The per-line spread at a smaller size.** Flattening fixes the overlap but
  not the misaligned columns or the re-spread on zoom.
- **Hiding chevrons in `superCompact` outright.** A 3–4 px box still holds a
  2–3 px chevron that reads.
- **A 40 px minimum spacing.** Its 40–80 px range thinned the display to about
  57 px on average, and the zoom buttons, which double bpPerPx, keep a session
  at whatever point of that range it started.
- **Rounding multi-way's layout origin onto the grid.** It fixed panning only
  (a zoom still slid the chevrons along the introns), moved the resting
  `dragOffsetPx` off 0 and broke the tables' multi-way parity.
- **Offsetting multi-way's packed px by the origin's phase.** It would thread
  the origin through `buildLaneCells`, the glyph layers and `glyphBlockRange`
  for one display's chevrons, and still slide them during a zoom.
- **The grid step as a uniform computed in JS.** With the boundaries off round
  bpPerPx values, the GPU and Canvas2D pick different steps only within about
  1e-8 of a boundary; the shader rounds the step before masking with it.
- **Dropping `chevronDrawSlots`' spare slot.** It costs one slot per line and
  guards the shader's rounding of the window ends.
