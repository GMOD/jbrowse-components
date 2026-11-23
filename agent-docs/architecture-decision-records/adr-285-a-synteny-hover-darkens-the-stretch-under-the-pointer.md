---
status: Accepted
summary: "A synteny or dotplot hover lights the hovered alignment at two levels: the whole alignment takes the alpha boost (dotplot: the restroke), and only the stretch of matches or the indel under the pointer darkens (dotplot: strokes wider). A stretch ends at an indel the view draws, so the threshold for splitting it is one pixel"
---

# ADR-285: A synteny hover darkens the stretch under the pointer

## Status

Accepted (2026-11-23). GitHub #5141.

## Context

Since 9166808aab the synteny and dotplot hover text names the stretch of matches
under the pointer, between the indels drawn on either side. The shading still
lit the whole alignment, so on an alignment broken by large indels the tooltip
named one piece while every piece lit up.

## Decision

- **Two levels.** The hovered alignment takes `fillShade`'s alpha boost; the
  stretch under the pointer, or a colored indel wedge, also takes
  `hoverDarken`. A pointer on a see-through gap or a sub-pixel run lights the
  alignment and darkens no part of it. An alignment drawn as one block darkens
  whole, as before.
- **The vertex stage decides.** `hoverLevel` in `syntenyTypes.slang` compares
  each instance's bp lanes against the hovered stretch's bounds on both axes
  (uniforms `hoveredStretch`, `hoveredStretchOn`) and hands the fragment a level
  in the slot that carried the feature id. Canvas2D calls the generated twin.
  Both axes are tested, so the stretches on either side of an insertion, which
  share their query bp, stay apart. The bounds are min/max'd, since a reversed
  walk runs either axis backwards.
- **The dotplot restrokes the stretch wider** over the whole-alignment
  restroke (`stretchPath`), from `matchStretchRange`.
- **The threshold is one pixel.** A stretch ends at an indel the view draws,
  and a sub-pixel indel is folded into the matches around it (ADR-276). Zoomed
  in, a 1 bp deletion does split the darkened stretch; the alignment-level boost
  keeps the pieces reading as one alignment.

## Rejected

- **Only the stretch lights.** The rest of the alignment then looks unhovered,
  and a sweep along a ribbon whose indels are 1–3 px flickers between a sliver,
  nothing and the next sliver.
- **A gap lights the two stretches around it.** The tooltip already names the
  indel.
- **A bp threshold for splitting.** It would need a new setting, and the pixel
  rule already decides what is drawn.

## Consequences

- At display opacity 0.35 and above the alpha boost is inert, so the rest of
  the alignment reads as unhovered and a gap hover shows nothing. A light
  darkening for the alignment level is the change to make if that matters.
- The multi-way view writes `hoveredStretchOn` 0 and keeps whole-feature
  hover; its hover is group-based. The alignments pileup keeps the whole read
  as its hover unit.
- SVG export draws no hover, so goldens do not move.
