import { BASE_QUALITY_UNAVAILABLE } from '../features/perBaseQuality/colors.ts'
import { RC_MAPQ } from '../shaders/slang/read.consts.generated.ts'

import type { NumericExtent } from './bakedColorScale.ts'
import type { ColoredByGroup } from './groupLayout.ts'

/** The MAPQ span of the reads the ramp paints, over every laid-out region. */
export function mapqExtentAcrossGroups(
  byGroup: ColoredByGroup,
): NumericExtent | undefined {
  let min = Infinity
  let max = -Infinity
  for (const map of byGroup.values()) {
    for (const { readMapqs, readColorCategories } of map.values()) {
      for (let i = 0; i < readMapqs.length; i++) {
        if (readColorCategories[i] === RC_MAPQ) {
          const mapq = readMapqs[i]!
          min = Math.min(min, mapq)
          max = Math.max(max, mapq)
        }
      }
    }
  }
  return min <= max ? [min, max] : undefined
}

export interface QualitySpan {
  extent: NumericExtent | undefined
  unavailable: boolean
}

export const NO_QUALITY_SPAN: QualitySpan = {
  extent: undefined,
  unavailable: false,
}

/**
 * The span of the base qualities drawn over every laid-out region, and whether
 * any base carries none.
 */
export function baseQualitySpanAcrossGroups(
  byGroup: ColoredByGroup,
): QualitySpan {
  let min = Infinity
  let max = -Infinity
  let unavailable = false
  for (const map of byGroup.values()) {
    for (const { perBaseQualScores } of map.values()) {
      for (const score of perBaseQualScores) {
        if (score === BASE_QUALITY_UNAVAILABLE) {
          unavailable = true
        } else {
          min = Math.min(min, score)
          max = Math.max(max, score)
        }
      }
    }
  }
  return { extent: min <= max ? [min, max] : undefined, unavailable }
}
