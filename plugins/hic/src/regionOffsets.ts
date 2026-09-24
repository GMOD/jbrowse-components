import type { HicResultRegion } from './RenderHicDataRPC/types.ts'
import type { Region } from '@jbrowse/core/util/types'
import type { TriangleAxisBlock } from '@jbrowse/display-kit/triangleTransform'

/**
 * Zip the renamed regions back together with their axis layout. A bin is a
 * chromosome-absolute index, so `(bin + combinedOffset) * binWidth` lands it at
 * its axis position; the two large terms cancel in double precision before
 * anything becomes float32.
 */
export function buildResultRegions(
  regions: Region[],
  axisBlocks: TriangleAxisBlock[],
  res: number,
): HicResultRegion[] {
  return regions.map((region, i) => {
    const { refName, offsetBp } = axisBlocks[i]!
    return {
      refName,
      dataXStart: offsetBp / Math.SQRT2,
      dataXEnd: (offsetBp + (region.end - region.start)) / Math.SQRT2,
      combinedOffset: (offsetBp - region.start) / res,
      reversed: !!region.reversed,
    }
  })
}

/**
 * Reflect a pre-rotation coordinate within its region's own span, which is how
 * a reversed region draws: the region keeps its place on the axis, so mixed
 * orientations work. Its own inverse.
 */
export function mirrorU(region: HicResultRegion, u: number) {
  return region.dataXStart + region.dataXEnd - u
}
