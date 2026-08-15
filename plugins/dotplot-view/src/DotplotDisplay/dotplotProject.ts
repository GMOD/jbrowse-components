// The cumBp -> plot px reconstruction, in one place.
//
// Absolute genomic cumBp is the space all dotplot geometry lives in
// (`buildLineSegments`), and every consumer has to put it on screen with the
// same two lines: subtract the viewport-start cumBp, divide by bpPerPx (held
// inverted, so a multiply), and on the vertical axis flip through the plot
// height, because that axis lays out bottom-up.
//
// **The flip is the whole reason these are functions.** Three callers project
// the same coordinates — `drawDotplotInstances`, `pickDotplotFeature`'s exact
// test, and `DotplotDisplay.hoveredFeatureHighlight` — and the first two MUST
// agree pixel for pixel, or the cursor picks an alignment other than the one it
// is pointing at. An axis-typed name cannot forget to flip; a hand-written
// `viewHeight - (…)` can, and can be written on the wrong axis. Same reason
// `syntenyRibbonPath.ts` exists on the synteny side, so that "drawn" and
// "pickable" cannot answer differently.
//
// Primitives, not a transform object, and that is measured rather than assumed:
// `benches/cumBpProjection.bench.ts` A/Bs this shape against the two that read
// better. Taking the transform as an object costs the Canvas2D loop 1.44-1.47x
// (1.25-1.39x even with every call site normalized to one hidden class, so it
// is the call and the scratch tuple, not the polymorphism); a projector closure
// built outside the loop costs 3.4-3.7x. This form is 0.98-1.01x — free, at the
// price of each caller passing the two numbers for its axis. The loop it has to
// be free in runs over 10^5+ segments a frame on the no-GPU path.
//
// The fourth copy is `shaders/dotplot.slang`, which cannot import this. The
// bench header says what that leaves.

export function cumBpToPxH(
  cumBp: number,
  viewBpH: number,
  bpPerPxHInv: number,
) {
  return (cumBp - viewBpH) * bpPerPxHInv
}

export function cumBpToPxV(
  cumBp: number,
  viewBpV: number,
  bpPerPxVInv: number,
  viewHeight: number,
) {
  return viewHeight - (cumBp - viewBpV) * bpPerPxVInv
}
