// What an arc DRAWS AS, as an enum, and the one predicate over it.
//
// Its own module because the DRAW side is what reads it — `mark.ts`,
// `packGpu.ts`, `drawCanvas.ts`, `crossRegionOverlay.ts` and the display's
// `tooltipUtils.ts` — and each of the five took it from `compute.ts`, which is
// the worker-side read grouping, junction clustering and colour classification.
// Two thousand lines pulled into the render path for three constants and a
// predicate, and a cycle waiting for the first time `compute.ts` wants anything
// back from `mark.ts`.
//
// THE VALUES ARE NOT PINNED TO ANYTHING, and they used to say they were:
// "shared with arc.slang (which checks them via `> 0.5` / `> 1.5` thresholds);
// keep in lockstep". arc.slang refutes that in its own header — "There is no
// `shapeType` attribute. It used to select between this curve and [the flat
// line]" — because the flat forms moved to arcFlat.slang and `packArcs` filters
// the feed to the curved ones, so no shader is handed a shapeType at all. The
// one value that still crosses the boundary is ARC_SHAPE_FLAT_SPLIT, and it
// crosses as `packArcFlats`' `dashed` 0/1 bit, resolved on the CPU. A lockstep
// note outliving its contract is the same defect as a twin with no note: it
// tells the next editor these numbers are load-bearing when nothing bears on
// them.

// The single curved paired-read shape. Its on-screen form is chosen by the
// *renderer* from how wide the pair is, not by a bp threshold here: a rounded
// dome while both mates fit on screen, collapsing to near-vertical lines rising
// from each real endpoint once the pair spans wider than the screen (the circle
// gets so big the band clips its apex). The endpoints always sit at the true
// genomic coordinates. See `arcRadiiPx` in arc.slang.
export const ARC_SHAPE_ARC = 0
// read-cloud flat line at Y=|tlen|; the split variant is drawn dashed
// (matching samplot.py's plot_split_plan dotted-line style).
export const ARC_SHAPE_FLAT = 1
export const ARC_SHAPE_FLAT_SPLIT = 2

// Both flat variants (solid read-cloud line + dashed split line) plot as a
// horizontal line with endpoint-square markers, unlike the curved ARC shape.
//
// It answers "does this draw as a bar" and NEVER "does this have an insert
// size" — only ARC_SHAPE_FLAT, the mate link, carries a TLEN. `formatArcTooltip`
// is where that bites and says so, and the display's CLAUDE.md states the rule;
// it belongs on the predicate too, now that the predicate has a home.
export function isFlatArcShape(shape: number) {
  return shape === ARC_SHAPE_FLAT || shape === ARC_SHAPE_FLAT_SPLIT
}
