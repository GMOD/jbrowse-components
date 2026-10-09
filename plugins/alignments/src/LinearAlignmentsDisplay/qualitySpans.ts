import { BASE_QUALITY_UNAVAILABLE } from '../features/perBaseQuality/colors.ts'
import { MAPQ_UNAVAILABLE } from '../shared/util.ts'

import type { NumericExtent } from './bakedColorScale.ts'
import type { LaidOutByGroup } from './groupLayout.ts'

/** The MAPQ span of the reads with one, over every laid-out region. */
export function mapqExtentAcrossGroups(
  byGroup: LaidOutByGroup,
): NumericExtent | undefined {
  let min = Infinity
  let max = -Infinity
  for (const map of byGroup.values()) {
    for (const { readMapqs } of map.values()) {
      for (let i = 0; i < readMapqs.length; i++) {
        const mapq = readMapqs[i]!
        if (mapq !== MAPQ_UNAVAILABLE) {
          min = Math.min(min, mapq)
          max = Math.max(max, mapq)
        }
      }
    }
  }
  return min <= max ? [min, max] : undefined
}

/** The MAPQ values the reads carry, as a categorical key lists them. */
export function presentMapqs(byGroup: LaidOutByGroup) {
  const seen = new Uint8Array(MAPQ_UNAVAILABLE)
  for (const map of byGroup.values()) {
    for (const { readMapqs } of map.values()) {
      for (let i = 0; i < readMapqs.length; i++) {
        seen[readMapqs[i]!] = 1
      }
    }
  }
  const present = new Set<string>()
  seen.forEach((hit, mapq) => {
    if (hit) {
      present.add(`${mapq}`)
    }
  })
  return present
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
  byGroup: LaidOutByGroup,
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
