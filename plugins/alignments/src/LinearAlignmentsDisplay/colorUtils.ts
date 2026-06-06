import { abgrToCssRgba, normalizedRgbToCss } from '@jbrowse/core/util/colorBits'

import { ColorScheme } from './constants.ts'

import type { LinkedReadsMode } from './constants.ts'
import type { ColorPalette, RGBColor } from './shaders/colors.ts'

// Re-exports from core — kept for backwards-compat with call sites.
export const rgb255 = normalizedRgbToCss

function lerpRgb255(a: RGBColor, b: RGBColor, t: number) {
  const r = Math.round((a[0] + (b[0] - a[0]) * t) * 255)
  const g = Math.round((a[1] + (b[1] - a[1]) * t) * 255)
  const bl = Math.round((a[2] + (b[2] - a[2]) * t) * 255)
  return `rgb(${r},${g},${bl})`
}

interface ReadColorData {
  readStrands: Int8Array
  readFlags: Uint16Array
  readMapqs: Uint8Array
  readInsertSizes: Float32Array
  readPairOrientations: Uint8Array
  readTagColors: Uint32Array
  readChainHasSupp?: Uint8Array
  readInterchrom: Uint8Array
  insertSizeStats?: { upper: number; lower: number }
}

function strandColor(strand: number, palette: ColorPalette) {
  if (strand > 0) {
    return rgb255(palette.colorFwdStrand)
  }
  if (strand < 0) {
    return rgb255(palette.colorRevStrand)
  }
  return rgb255(palette.colorNostrand)
}

function pairOrientationColor(po: number, palette: ColorPalette) {
  if (po === 1) {
    return rgb255(palette.colorPairLR)
  }
  if (po === 2) {
    return rgb255(palette.colorPairRL)
  }
  if (po === 3) {
    return rgb255(palette.colorPairRR)
  }
  if (po === 4) {
    return rgb255(palette.colorPairLL)
  }
  return rgb255(palette.colorNostrand)
}

function insertSizeColor(
  insertSize: number,
  stats: { upper: number; lower: number } | undefined,
  palette: ColorPalette,
) {
  if (stats && insertSize > stats.upper) {
    return rgb255(palette.colorLongInsert)
  }
  if (stats && insertSize < stats.lower) {
    return rgb255(palette.colorShortInsert)
  }
  return rgb255(palette.colorPairLR)
}

export function getReadColor(
  i: number,
  data: ReadColorData,
  colorScheme: number,
  palette: ColorPalette,
  opts?: {
    linkedReads?: LinkedReadsMode
    flipStrandLongReadChains?: boolean
  },
) {
  const flags = data.readFlags[i]!
  const strand = data.readStrands[i]!
  const isChain = opts?.linkedReads !== undefined && opts.linkedReads !== 'off'

  // In chain/linked-read mode, supplementary chains use orange for paired-end reads
  const chainSupp = data.readChainHasSupp?.[i] ?? 0
  if (isChain && chainSupp > 0) {
    const isPaired = (flags & 1) !== 0
    if (isPaired) {
      return rgb255(palette.colorSupplementary)
    }
    const primaryStrand = chainSupp > 1 ? -1 : 1
    const effectiveStrand =
      opts.flipStrandLongReadChains !== false ? strand * primaryStrand : strand
    return strandColor(effectiveStrand, palette)
  }

  // unmapped mate (flag 8) — brown for orientation-aware schemes (tlen=0 would
  // miscolor as "short insert" pink), or normal scheme in linked-read mode
  const mateUnmapped = (flags & 8) !== 0
  const isOrientationScheme =
    colorScheme === ColorScheme.insertSize ||
    colorScheme === ColorScheme.pairOrientation ||
    colorScheme === ColorScheme.insertSizeAndOrientation ||
    colorScheme === ColorScheme.insertSizeGradient
  if (
    mateUnmapped &&
    (isOrientationScheme || (colorScheme === ColorScheme.normal && isChain))
  ) {
    return rgb255(palette.colorUnmappedMate)
  }

  // Mate on another chromosome: orientation/insert size are meaningless, so
  // paint one distinct color instead of an LR/RL/etc hue (mirrors read.slang).
  if (data.readInterchrom[i] === 1 && isOrientationScheme) {
    return rgb255(palette.colorInterchrom)
  }

  switch (colorScheme) {
    case ColorScheme.normal:
      return rgb255(palette.colorPairLR)

    case ColorScheme.strand:
      return strandColor(strand, palette)

    // hue = mapq degrees (0–255), browser native hsl() is fastest
    case ColorScheme.mappingQuality:
      return `hsl(${data.readMapqs[i]},50%,50%)`

    case ColorScheme.insertSize:
      return insertSizeColor(
        data.readInsertSizes[i]!,
        data.insertSizeStats,
        palette,
      )

    case ColorScheme.firstOfPairStrand: {
      const isFirst = (flags & 64) !== 0
      const effectiveStrand = isFirst ? strand : -strand
      return strandColor(effectiveStrand, palette)
    }

    case ColorScheme.pairOrientation:
      return pairOrientationColor(data.readPairOrientations[i]!, palette)

    // Non-LR orientation wins; otherwise fall back to insert-size threshold
    case ColorScheme.insertSizeAndOrientation: {
      const po = data.readPairOrientations[i]!
      if (po === 2 || po === 3 || po === 4) {
        return pairOrientationColor(po, palette)
      }
      return insertSizeColor(
        data.readInsertSizes[i]!,
        data.insertSizeStats,
        palette,
      )
    }

    case ColorScheme.modifications: {
      const isReverse = (flags & 16) !== 0
      return rgb255(
        isReverse ? palette.colorModificationRev : palette.colorModificationFwd,
      )
    }

    case ColorScheme.tag: {
      const packed = data.readTagColors[i]
      return packed ? abgrToCssRgba(packed) : rgb255(palette.colorPairLR)
    }

    case ColorScheme.insertSizeGradient: {
      const insertSize = data.readInsertSizes[i]!
      const stats = data.insertSizeStats
      // Span = 6σ (upper−lower); gradient saturates at ~9σ from mean,
      // giving meaningful range for outlier severity.
      const span = stats ? stats.upper - stats.lower : 0
      if (stats && span > 0) {
        if (insertSize > stats.upper) {
          return lerpRgb255(
            palette.colorPairLR,
            palette.colorLongInsert,
            Math.min((insertSize - stats.upper) / span, 1),
          )
        }
        if (insertSize < stats.lower) {
          return lerpRgb255(
            palette.colorPairLR,
            palette.colorShortInsert,
            Math.min((stats.lower - insertSize) / span, 1),
          )
        }
      }
      return rgb255(palette.colorPairLR)
    }

    default:
      return rgb255(palette.colorPairLR)
  }
}

export { normalizedRgbToCssRgba as rgba255 } from '@jbrowse/core/util/colorBits'
