import {
  MISCONFIGURED_COLOR,
  NO_CATEGORY_COLOR,
} from '@jbrowse/core/util/color'
import { thresholdCuts } from '@jbrowse/core/util/thresholdScale'
import { colorEncodingOf } from '@jbrowse/display-kit/colorConfigSchema'
import { colorNotices, fieldScaleOf } from '@jbrowse/display-kit/colorScale'
import { MAX_WIGGLE_CUTS } from '@jbrowse/wiggle-core'

import { WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'
import { rampLutOf } from './densityColorRamp.ts'
import { SOURCE_FIELD, WIGGLE_FIELD_SCALES } from './wiggleColorConfigSchema.ts'

import type { SourcePalette } from '../LinearWiggleDisplay/sourcesLogic.ts'
import type {
  ColorSetting,
  FieldColorEncoding,
} from '@jbrowse/display-kit/colorConfigSchema'

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
  /** Each source takes a palette entry of its own (`field: 'source'`). */
  perSource: boolean
}

/**
 * A wiggle colour as it paints. Unset beside a field, the scale follows the
 * field: `source` is categorical, and `score` the bicolor cut.
 */
export function wiggleColorEncoding(color: ColorSetting) {
  return colorEncodingOf(color, fieldScaleOf(WIGGLE_FIELD_SCALES, color.field))
}

/** What the `color` object's slots say together that it cannot paint as written. */
export function wiggleColorNotices(color: ColorSetting) {
  return colorNotices(color, fieldScaleOf(WIGGLE_FIELD_SCALES, color.field))
}

/**
 * Whether the display paints this encoding: `source` through a categorical
 * scale, `score` through any other. The layers part into two sides of one
 * value, so a colour per score and a cut or ramp over subtrack names have
 * nothing to paint with.
 */
function paints(encoding: FieldColorEncoding) {
  return (
    (encoding.field === SOURCE_FIELD) === (encoding.scale === 'categorical')
  )
}

/**
 * The cuts a threshold over `score` declares, ascending, at most
 * `MAX_WIGGLE_CUTS`. Empty for any other encoding, and for a threshold naming
 * no cut, which parts at the `origin`.
 */
export function declaredCuts(encoding: ReturnType<typeof wiggleColorEncoding>) {
  return typeof encoding === 'object' &&
    encoding.scale === 'threshold' &&
    paints(encoding)
    ? thresholdCuts(encoding.domain ?? []).slice(0, MAX_WIGGLE_CUTS)
    : []
}

/**
 * What a colour per source hands out: the sources its `domain` lists take its
 * `range` first. Undefined for any other encoding.
 */
export function sourcePalette(
  encoding: ReturnType<typeof wiggleColorEncoding>,
): SourcePalette | undefined {
  return typeof encoding === 'object' &&
    encoding.scale === 'categorical' &&
    paints(encoding)
    ? {
        domain: encoding.domain?.map(String) ?? [],
        range: encoding.range ?? [],
      }
    : undefined
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
    perSource: false,
  }
}

export function resolveWiggleColor(
  encoding: ReturnType<typeof wiggleColorEncoding>,
  origin: number,
): ResolvedWiggleColor {
  if (typeof encoding !== 'object') {
    return solid(encoding ?? WIGGLE_POS_COLOR_DEFAULT, origin)
  }
  if (!paints(encoding)) {
    return solid(MISCONFIGURED_COLOR, origin)
  }
  switch (encoding.scale) {
    case 'categorical':
      return { ...solid(WIGGLE_POS_COLOR_DEFAULT, origin), perSource: true }
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
        perSource: false,
      }
    }
    case 'linear':
    case 'log': {
      const { range = [], scheme, reverse = false, domainMid } = encoding
      const ends = reverse ? range.toReversed() : range
      return {
        negColor: ends[0] ?? WIGGLE_NEG_COLOR_DEFAULT,
        posColor: ends.at(-1) ?? WIGGLE_POS_COLOR_DEFAULT,
        pivot: domainMid ?? origin,
        cuts: [domainMid ?? origin],
        innerColors: [],
        rampLut: rampLutOf({
          range: range.length === 1 ? ['white', range[0]!] : range,
          scheme,
          reverse,
        }),
        rampMid: domainMid,
        perSource: false,
      }
    }
  }
}
