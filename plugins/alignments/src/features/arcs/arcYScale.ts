// Single source of truth for the arcs band's yBp→vertical-fraction mapping,
// shared by the Canvas2D/SVG draw (drawCanvas.ts) and the insert-size ruler
// ticks (insertSizeTicks.ts) so the plotted lines and the tick labels can't
// drift. Must stay byte-identical to the `arcsYLog` branch in arc.slang's
// evalArcPoint (the GPU path). Returns a fraction in [0, ∞); callers clamp to
// the band height.
//
//   samplot (log):  base-2 log scale, matching origin/main's
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
