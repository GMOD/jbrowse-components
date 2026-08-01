import { ARC_HEIGHT_MARGIN } from '../../LinearAlignmentsDisplay/shaders/slang/arc.iface.generated.ts'

// Single source of truth for the arcs band's yBp→vertical-fraction mapping,
// shared by the Canvas2D/SVG draw (drawCanvas.ts) and the insert-size ruler
// ticks (insertSizeTicks.ts) so the plotted lines and the tick labels can't
// drift. Must stay byte-identical to the `arcsYLog` branch in arc.slang's
// evalArcPoint (the GPU path). Returns a fraction in [0, ∞); callers clamp to
// the band height.
//
//   read cloud (log):  base-2 log scale, matching origin/main's
//                   d3.scaleLog().base(2).domain([1, max(2, domain)]) — small
//                   inserts spread out near the baseline instead of collapsing.
//   arc mode (lin): yBp is a genomic radius, mapped linearly.
export function arcYFraction(
  yBp: number,
  arcsYDomainBp: number,
  log: boolean,
): number {
  return log
    ? Math.log2(Math.max(1, yBp)) / Math.log2(Math.max(2, arcsYDomainBp))
    : arcsYDomainBp > 0
      ? yBp / arcsYDomainBp
      : 0
}

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

// Distance from the band's zero anchor to where `yBp` plots, clamped to the
// band. Mirrors arcBandDestY in alignmentsUniforms.slang; shared by the arc
// draw and the insert-size ruler so a tick lands on the apex of the arc
// plotting its value.
export function arcYOffsetPx(
  yBp: number,
  domainBp: number,
  log: boolean,
  availH: number,
) {
  return Math.min(arcYFraction(yBp, domainBp, log) * availH, availH)
}
