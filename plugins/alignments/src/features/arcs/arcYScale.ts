// The arcs band's yBp→vertical-fraction mapping, and the clamped px offset
// built on it, are generated from alignmentsUniforms.slang (adr-051). Both were
// hand-written here under a "must stay byte-identical" SYNC tag, which is the
// strongest possible statement that they should not have been two functions.
//
//   read cloud (log):  base-2 log scale, matching origin/main's
//                   d3.scaleLog().base(2).domain([1, max(2, domain)]) — small
//                   inserts spread out near the baseline instead of collapsing.
//   arc mode (lin): yBp is a genomic radius, mapped linearly.
//
// Re-exported under these names because they are the arcs feature's vocabulary
// and every caller already imports them from here; the shader adopted the same
// spelling rather than the other way round.
//
// `arcAvailH` — the band's plottable height, floored at 0 — is the third, and is
// shared for the same reason: arc.slang, arcFlat.slang and arcMarker.slang each
// subtract the margin too, and a floor only one side applies means the two
// backends draw a too-short band differently. The slang declaration carries why
// the floor is there.
export {
  arcAvailH,
  arcYFraction,
  arcYOffsetPx,
} from '../../shaders/slang/alignmentsUniforms.js.generated.ts'

// The band edge insert size 0 springs from: the bottom when arcs point up, the
// top when they point down. One line, and it was written five times — here as
// `arcMark`'s anchor, again in `drawArcsToCtx`, again in `hitTestArcBand`,
// again as the insert-size ruler's `anchor`, and a fifth time as the GPU's
// `arcAnchorPx` uniform. Every one of them has to agree or the ruler labels a
// height nothing plots at, so it is the same missing-function shape the rest of
// this directory already collapsed.
export function arcAnchorY(top: number, height: number, down: boolean) {
  return down ? top : top + height
}

// A drawn-side-positive offset (what `arcYOffsetPx` returns) placed on screen.
// The direction flip is the shader's `yDir` said in CPU terms, and it is the
// other half of the ruler-meets-the-arcs invariant: `computeInsertSizeTicks`
// and `arcMark` both turn an offset into a screen y and must do it the
// same way.
export function arcMarkY(anchorY: number, offsetPx: number, down: boolean) {
  return down ? anchorY + offsetPx : anchorY - offsetPx
}

// The band's Y scale for one draw. Read cloud supplies an autoscaled |tlen|
// domain and reads it on a base-2 log axis; arc mode supplies none and falls
// back to the bp span that fits `availH` at the current zoom, which reproduces
// a plain `yBp * pxPerBp` linear mapping. Shared by the Canvas2D/SVG draw and
// `fillArcUniforms` so the two renderers can't pick different domains.
export function arcYScale(
  arcsYDomainBp: number | undefined,
  availH: number,
  pxPerBp: number,
) {
  return {
    domainBp: arcsYDomainBp ?? (pxPerBp > 0 ? availH / pxPerBp : 1),
    log: arcsYDomainBp !== undefined,
  }
}
