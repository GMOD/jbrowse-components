import { quartileGap, spanGaps } from '@jbrowse/render-core/marks/sparseSpans'

import type { MarkRegionData } from './markList.ts'

/**
 * Each row key's lower-quartile gap in bp between the instances of the marks
 * `isRect` names, pooled over the loaded regions: the gaps of each region's
 * row, on that region's own sequence, so a row's rects leave room or not
 * whatever zoom reads it (`leavesRoom`). A key whose rects leave no gap is
 * absent. An unsplit region's instances are key 0.
 */
export function rowQuartileGaps(
  regions: Iterable<MarkRegionData>,
  isRect: readonly boolean[],
) {
  const gapsOf = new Map<number, number[]>()
  for (const region of regions) {
    const spansOf = new Map<number, [number, number][]>()
    region.layers.forEach((layer, i) => {
      if (isRect[i]) {
        for (let k = 0; k < layer.count; k++) {
          const key = layer.row?.[k] ?? 0
          const spans = spansOf.get(key) ?? []
          spans.push([layer.x[k]!, layer.x2[k]!])
          spansOf.set(key, spans)
        }
      }
    })
    for (const [key, spans] of spansOf) {
      const gaps = gapsOf.get(key) ?? []
      gaps.push(...spanGaps(spans))
      gapsOf.set(key, gaps)
    }
  }
  const quartiles = new Map<number, number>()
  for (const [key, gaps] of gapsOf) {
    const gap = quartileGap(gaps.sort((a, b) => a - b))
    if (gap !== undefined) {
      quartiles.set(key, gap)
    }
  }
  return quartiles
}
