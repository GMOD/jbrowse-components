import { abgrToCssRgba, packAbgr } from '@jbrowse/core/util/colorBits'
import { rampLutOf, stopsFromRampLut } from '@jbrowse/core/util/colorRamp'

import type { RampScale } from '@jbrowse/core/ui/colorScale'

const QUALITY_LUT = rampLutOf({ scheme: 'cividis' })
const QUALITY_KEY_STOPS = stopsFromRampLut(QUALITY_LUT, 8)

export const MAPQ_RAMP_MAX = 60

export const BASE_QUALITY_RAMP_MAX = 40

/**
 * One packed ABGR colour per 8-bit score, entry `i` the cividis table's colour
 * at `min(i, max) / max`, indexed as `stopsFromRampLut` reads the key's stops.
 */
export function qualityRampAbgr(max: number) {
  const last = QUALITY_LUT.length / 4 - 1
  return Uint32Array.from({ length: 256 }, (_, score) => {
    const o = Math.round((Math.min(score, max) / max) * last) * 4
    return packAbgr(
      QUALITY_LUT[o]!,
      QUALITY_LUT[o + 1]!,
      QUALITY_LUT[o + 2]!,
      255,
    )
  })
}

export const MAPQ_ABGR = qualityRampAbgr(MAPQ_RAMP_MAX)

export const MAPQ_CSS = Array.from(MAPQ_ABGR, abgrToCssRgba)

/** A quality ramp's colour bar, over `[0, max]`, marking an end `extent` runs past. */
export function qualityRampScale(
  id: string,
  title: string,
  max: number,
  extent: readonly [number, number] | undefined,
): RampScale {
  return {
    kind: 'ramp',
    id,
    title,
    domain: [0, max],
    stops: QUALITY_KEY_STOPS,
    extent,
  }
}
