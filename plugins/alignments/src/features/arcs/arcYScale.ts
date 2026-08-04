import { ARC_HEIGHT_MARGIN } from '../../LinearAlignmentsDisplay/shaders/slang/arc.iface.generated.ts'

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
export {
  arcYFraction,
  arcYOffsetPx,
} from '../../LinearAlignmentsDisplay/shaders/slang/alignmentsUniforms.js.generated.ts'

// Plottable height of the band: the drawn height less the apex padding.
export function arcAvailH(bandH: number) {
  return bandH - ARC_HEIGHT_MARGIN
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
