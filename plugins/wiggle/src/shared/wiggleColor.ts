import { numericDomain } from '@jbrowse/core/util/thresholdScale'
import { paintedScale } from '@jbrowse/display-kit/colorConfigSchema'

import { WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'
import { densityRampLut, stopRampLut } from './densityColorRamp.ts'

import type { FullColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

/**
 * The colour object as the encoder and both backends take it: the pair every
 * mode already partitions by, the value they part at, and the density LUT.
 * One shape for all five scales, so a rendering asks what to paint rather
 * than which spelling the config used.
 */
export interface ResolvedWiggleColor {
  /** At or above `pivot`, and the whole plot where nothing parts. */
  posColor: string
  /** Below `pivot`. */
  negColor: string
  /** Where the two sides part, and the value density draws its ramp's middle stop at. */
  pivot: number
  /** A declared ramp's 256 entries, or null for the two-sided fade off `posColor`/`negColor`. */
  rampLut: Uint8Array | null
  /** Each source takes a palette entry of its own (`field: 'source'`). */
  perSource: boolean
}

/**
 * The scale a wiggle colour paints through. Unset beside a field it follows
 * the field: `source` is categorical, `score` the bicolor cut, and a declared
 * ramp is the density fade whatever the field is called.
 */
export function wiggleColorScale(color: FullColorSetting) {
  return paintedScale(
    color,
    color.ramp.length > 0
      ? 'linear'
      : color.field === 'source'
        ? 'categorical'
        : 'threshold',
  )
}

export function resolveWiggleColor(
  color: FullColorSetting,
  origin: number,
): ResolvedWiggleColor {
  const solid = color.value ?? WIGGLE_POS_COLOR_DEFAULT
  const base = {
    posColor: solid,
    negColor: solid,
    pivot: origin,
    rampLut: null,
    perSource: false,
  }
  switch (wiggleColorScale(color)) {
    case 'none':
      return base
    case 'categorical':
      return { ...base, perSource: true }
    case 'threshold': {
      const [cut] = numericDomain(color.domain)
      return {
        ...base,
        negColor: color.palette[0] ?? WIGGLE_NEG_COLOR_DEFAULT,
        posColor: color.palette[1] ?? WIGGLE_POS_COLOR_DEFAULT,
        pivot: cut === undefined || !Number.isFinite(cut) ? origin : cut,
      }
    }
    default: {
      // A ramp runs from the colour at `pivot` out to the ends of the y
      // domain, so its stops are a magnitude and `domainMid` is where that
      // magnitude is zero.
      const stops = color.ramp
      const pivot = color.domainMid ?? origin
      const named = stops.length === 1 ? densityRampLut(stops[0]) : null
      return named
        ? {
            ...base,
            negColor: WIGGLE_NEG_COLOR_DEFAULT,
            posColor: WIGGLE_POS_COLOR_DEFAULT,
            pivot,
            rampLut: named,
          }
        : {
            ...base,
            negColor: stops[0] ?? WIGGLE_NEG_COLOR_DEFAULT,
            posColor: stops.at(-1) ?? WIGGLE_POS_COLOR_DEFAULT,
            pivot,
            rampLut: stops.length > 1 ? stopRampLut(stops) : null,
          }
    }
  }
}
