import { numericDomain } from '@jbrowse/core/util/thresholdScale'
import { paintedScale } from '@jbrowse/display-kit/colorConfigSchema'

import { WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'
import { rampLutOf } from './densityColorRamp.ts'

import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

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
 * the field: `source` is categorical, and anything else the bicolor cut.
 */
export function wiggleColorScale(color: ColorSetting) {
  return paintedScale(
    color,
    color.field === 'source' ? 'categorical' : 'threshold',
  )
}

export function resolveWiggleColor(
  color: ColorSetting,
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
        negColor: color.range[0] ?? WIGGLE_NEG_COLOR_DEFAULT,
        posColor: color.range[1] ?? WIGGLE_POS_COLOR_DEFAULT,
        pivot: cut === undefined || !Number.isFinite(cut) ? origin : cut,
      }
    }
    default: {
      // A ramp runs from the colour at `pivot` out to the ends of the y
      // domain, so its stops are a magnitude and `domainMid` is where that
      // magnitude is zero. With no range or scheme it is the two-sided fade
      // off the pos/neg pair.
      const { range, scheme, reverse = false } = color
      const pivot = color.domainMid ?? origin
      const ends = reverse ? range.toReversed() : range
      const [neg, pos] = reverse
        ? [WIGGLE_POS_COLOR_DEFAULT, WIGGLE_NEG_COLOR_DEFAULT]
        : [WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT]
      return {
        ...base,
        negColor: ends[0] ?? (scheme ? WIGGLE_NEG_COLOR_DEFAULT : neg),
        posColor: ends.at(-1) ?? (scheme ? WIGGLE_POS_COLOR_DEFAULT : pos),
        pivot,
        rampLut:
          range.length > 1 || (range.length === 0 && scheme)
            ? rampLutOf({ range, scheme, reverse })
            : null,
      }
    }
  }
}
