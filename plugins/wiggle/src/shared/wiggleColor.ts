import {
  MISCONFIGURED_COLOR,
  NO_CATEGORY_COLOR,
} from '@jbrowse/core/util/color'
import { rampLutOf } from '@jbrowse/core/util/colorRamp'
import { colorNotices } from '@jbrowse/core/util/colorScale'
import { thresholdCuts } from '@jbrowse/core/util/thresholdScale'
import { colorEncodingOf } from '@jbrowse/display-kit/colorConfigSchema'
import { MAX_WIGGLE_CUTS } from '@jbrowse/wiggle-core'

import { WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'
import { WIGGLE_FIELD_PRESETS } from './wiggleColorConfigSchema.ts'

import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

function lutColor(lut: Uint8Array, entry: number) {
  return `rgb(${lut[entry * 4]},${lut[entry * 4 + 1]},${lut[entry * 4 + 2]})`
}

/**
 * The colour object as the encoder and both backends take it: the pair every
 * mode already partitions by, the value they part at, and the density LUT.
 * One shape for every encoding, so a rendering asks what to paint rather than
 * which spelling the config used.
 */
export interface ResolvedWiggleColor {
  /** At or above the last cut, and the whole plot where nothing parts. */
  posColor: string
  /** Below `pivot`. */
  negColor: string
  /** The lowest cut, and where the density fade is white. */
  pivot: number
  /** Where the colour changes, ascending, `pivot` first; at most `MAX_WIGGLE_CUTS`. */
  cuts: number[]
  /** The colours between `negColor` and `posColor`, one per band between two cuts. */
  innerColors: string[]
  /** A ramp's 256 entries, or null for the white fade off `posColor`/`negColor`. */
  rampLut: Uint8Array | null
  /** The score at the ramp's middle stop; unset runs the ramp straight across the domain. */
  rampMid: number | undefined
}

/** A wiggle colour as it paints. Unset beside `score`, the scale is the bicolor cut. */
export function wiggleColorEncoding(color: ColorSetting) {
  return colorEncodingOf(color, WIGGLE_FIELD_PRESETS)
}

/**
 * The `color` object as it paints: naming neither `value` nor `field`, it is
 * the pos/neg pair, `score` through a threshold at its cuts or the `origin`.
 */
export function paintedWiggleColor<C extends ColorSetting>(color: C): C {
  return color.value !== undefined || color.field
    ? color
    : { ...color, field: 'score', scale: 'threshold' }
}

/** What the `color` object's slots say together that it cannot paint as written. */
export function wiggleColorNotices(color: ColorSetting) {
  return colorNotices(paintedWiggleColor(color), WIGGLE_FIELD_PRESETS)
}

/**
 * The cuts a threshold over `score` declares, ascending, at most
 * `MAX_WIGGLE_CUTS`. Empty for any other encoding, and for a threshold naming
 * no cut, which parts at the `origin`.
 */
export function declaredCuts(encoding: ReturnType<typeof wiggleColorEncoding>) {
  return typeof encoding === 'object' && encoding.scale === 'threshold'
    ? thresholdCuts(encoding.domain ?? []).slice(0, MAX_WIGGLE_CUTS)
    : []
}

function solid(color: string, pivot: number): ResolvedWiggleColor {
  return {
    posColor: color,
    negColor: color,
    pivot,
    cuts: [pivot],
    innerColors: [],
    rampLut: null,
    rampMid: undefined,
  }
}

export function resolveWiggleColor(
  encoding: ReturnType<typeof wiggleColorEncoding>,
  origin: number,
): ResolvedWiggleColor {
  if (typeof encoding !== 'object') {
    return solid(encoding ?? WIGGLE_POS_COLOR_DEFAULT, origin)
  }
  switch (encoding.scale) {
    case 'categorical':
      return solid(MISCONFIGURED_COLOR, origin)
    case 'threshold': {
      const declared = declaredCuts(encoding)
      const cuts = declared.length > 0 ? declared : [origin]
      const range = encoding.range ?? []
      return {
        negColor: range[0] ?? WIGGLE_NEG_COLOR_DEFAULT,
        posColor: range[cuts.length] ?? WIGGLE_POS_COLOR_DEFAULT,
        pivot: cuts[0]!,
        cuts,
        innerColors: cuts
          .slice(1)
          .map((_, i) => range[i + 1] ?? NO_CATEGORY_COLOR),
        rampLut: null,
        rampMid: undefined,
      }
    }
    case 'linear':
    case 'log': {
      const { range = [], scheme, reverse = false, domainMid } = encoding
      const rampLut = rampLutOf({
        range: range.length === 1 ? ['white', range[0]!] : range,
        scheme,
        reverse,
      })
      const ends = range.length
        ? reverse
          ? range.toReversed()
          : range
        : [lutColor(rampLut, 0), lutColor(rampLut, rampLut.length / 4 - 1)]
      return {
        negColor: ends[0]!,
        posColor: ends.at(-1)!,
        pivot: domainMid ?? origin,
        cuts: [domainMid ?? origin],
        innerColors: [],
        rampLut,
        rampMid: domainMid,
      }
    }
  }
}
