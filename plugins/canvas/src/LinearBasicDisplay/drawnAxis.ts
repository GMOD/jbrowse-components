import { mergeSpans } from '../shared/mergeSpans.ts'

interface RegionBounds {
  regionStart: number
  regionEnd: number
}

const genomic = (bp: number) => bp

/**
 * Genomic bp with the stretches between one ref group's regions cut out: the
 * axis the packer measures on. The view draws the regions side by side, so a
 * feature ending at one exon and another starting at the next sit together on
 * screen however much intron separates them, and packed on genomic bp they
 * share a row and read as one feature.
 *
 * A position inside a hidden stretch lands on its seam. Everywhere else
 * distances stay genomic, so one region, or regions that touch, pack exactly as
 * on genomic bp.
 */
export function drawnAxis(regions: Iterable<RegionBounds>) {
  const spans = mergeSpans(
    [...regions].map(r => [r.regionStart, r.regionEnd] as const),
  )
  const gaps: { start: number; end: number; hiddenBefore: number }[] = []
  let hidden = 0
  for (let i = 1; i < spans.length; i++) {
    const start = spans[i - 1]![1]
    const end = spans[i]![0]
    gaps.push({ start, end, hiddenBefore: hidden })
    hidden += end - start
  }
  if (gaps.length === 0) {
    return genomic
  }
  return (bp: number) => {
    let lo = 0
    let hi = gaps.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (gaps[mid]!.start < bp) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }
    const gap = gaps[lo - 1]
    return gap
      ? bp - gap.hiddenBefore - (Math.min(bp, gap.end) - gap.start)
      : bp
  }
}
