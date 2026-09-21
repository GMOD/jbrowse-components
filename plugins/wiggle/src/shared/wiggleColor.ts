import { MISCONFIGURED_COLOR } from '@jbrowse/core/util/color'
import { thresholdCuts } from '@jbrowse/core/util/thresholdScale'
import { colorEncodingOf } from '@jbrowse/display-kit/colorConfigSchema'

import { WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'
import { rampLutOf } from './densityColorRamp.ts'
import { SOURCE_FIELD } from './wiggleColorConfigSchema.ts'

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
 * A wiggle colour as it paints. Unset beside a field, the scale follows the
 * field: `source` is categorical, and `score` the bicolor cut.
 */
export function wiggleColorEncoding(color: ColorSetting) {
  return colorEncodingOf(
    color,
    color.field === SOURCE_FIELD ? 'categorical' : 'threshold',
  )
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
 * The cut a threshold over `score` declares: its lowest, which is the one the
 * two sides part at. Undefined for any other encoding, and for a threshold
 * naming no cut, which parts at the `origin`.
 */
export function declaredCut(encoding: ReturnType<typeof wiggleColorEncoding>) {
  return typeof encoding === 'object' &&
    encoding.scale === 'threshold' &&
    paints(encoding)
    ? thresholdCuts(encoding.domain ?? [])[0]
    : undefined
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
    rampLut: null,
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
      const [
        negColor = WIGGLE_NEG_COLOR_DEFAULT,
        posColor = WIGGLE_POS_COLOR_DEFAULT,
      ] = encoding.range ?? []
      return {
        posColor,
        negColor,
        pivot: declaredCut(encoding) ?? origin,
        rampLut: null,
        perSource: false,
      }
    }
    case 'linear':
    case 'log': {
      // A ramp runs from the colour at `pivot` out to the ends of the y
      // domain, so its stops are a magnitude and `domainMid` is where that
      // magnitude is zero. With no range or scheme it is the two-sided fade
      // off the pos/neg pair.
      const { range = [], scheme, reverse = false, domainMid } = encoding
      const ends = reverse ? range.toReversed() : range
      const [neg, pos] = reverse
        ? [WIGGLE_POS_COLOR_DEFAULT, WIGGLE_NEG_COLOR_DEFAULT]
        : [WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT]
      return {
        negColor: ends[0] ?? (scheme ? WIGGLE_NEG_COLOR_DEFAULT : neg),
        posColor: ends.at(-1) ?? (scheme ? WIGGLE_POS_COLOR_DEFAULT : pos),
        pivot: domainMid ?? origin,
        rampLut:
          range.length > 1 || (range.length === 0 && scheme)
            ? rampLutOf({ range, scheme, reverse })
            : null,
        perSource: false,
      }
    }
  }
}
