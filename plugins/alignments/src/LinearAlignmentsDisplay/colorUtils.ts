import {
  abgrToCssRgba,
  normalizedRgbToCss,
  normalizedRgbToCssRgba,
} from '@jbrowse/core/util/colorBits'

import type { ColorPalette, RGBColor } from './components/shaders/colors.ts'

const CS_NORMAL = 0
const CS_INSERT_SIZE = 3
const CS_PAIR_ORIENTATION = 5
const CS_INSERT_SIZE_AND_ORIENTATION = 6
const CS_INSERT_SIZE_GRADIENT = 10

function isOrientationScheme(cs: number) {
  return (
    cs === CS_INSERT_SIZE ||
    cs === CS_PAIR_ORIENTATION ||
    cs === CS_INSERT_SIZE_AND_ORIENTATION ||
    cs === CS_INSERT_SIZE_GRADIENT
  )
}

// Re-exports from core — kept for backwards-compat with call sites.
export const rgb255 = normalizedRgbToCss
export const rgba255 = normalizedRgbToCssRgba

export function lerpRgb255(a: RGBColor, b: RGBColor, t: number) {
  const r = Math.round((a[0] + (b[0] - a[0]) * t) * 255)
  const g = Math.round((a[1] + (b[1] - a[1]) * t) * 255)
  const bl = Math.round((a[2] + (b[2] - a[2]) * t) * 255)
  return `rgb(${r},${g},${bl})`
}

export function hslToRgbString(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = h * 6
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const m = l - c / 2
  let r: number
  let g: number
  let b: number
  if (hp < 1) {
    ;[r, g, b] = [c, x, 0]
  } else if (hp < 2) {
    ;[r, g, b] = [x, c, 0]
  } else if (hp < 3) {
    ;[r, g, b] = [0, c, x]
  } else if (hp < 4) {
    ;[r, g, b] = [0, x, c]
  } else if (hp < 5) {
    ;[r, g, b] = [x, 0, c]
  } else {
    ;[r, g, b] = [c, 0, x]
  }
  return `rgb(${Math.round((r + m) * 255)},${Math.round((g + m) * 255)},${Math.round((b + m) * 255)})`
}

export interface ReadColorData {
  readStrands: Int8Array
  readFlags: Uint16Array
  readMapqs: Uint8Array
  readAvgBaseQualities: Uint8Array
  readInsertSizes: Float32Array
  readPairOrientations: Uint8Array
  readTagColors: Uint32Array
  readChainHasSupp?: Uint8Array
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
    renderingMode?: string
    flipStrandLongReadChains?: boolean
  },
) {
  const flags = data.readFlags[i]!
  const strand = data.readStrands[i]!

  // In chain/linked-read mode, supplementary chains use orange for paired-end reads
  const chainSupp = data.readChainHasSupp?.[i] ?? 0
  if (opts?.renderingMode === 'linkedRead' && chainSupp > 0) {
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
  if (
    mateUnmapped &&
    (isOrientationScheme(colorScheme) ||
      (colorScheme === CS_NORMAL && opts?.renderingMode === 'linkedRead'))
  ) {
    return rgb255(palette.colorUnmappedMate)
  }

  switch (colorScheme) {
    // Normal
    case 0:
      return rgb255(palette.colorPairLR)

    // Strand
    case 1:
      return strandColor(strand, palette)

    // Mapping quality: hsl(mapq/360, 50%, 50%)
    case 2:
      return hslToRgbString(data.readMapqs[i]! / 360, 0.5, 0.5)

    // Insert size (threshold)
    case 3:
      return insertSizeColor(
        data.readInsertSizes[i]!,
        data.insertSizeStats,
        palette,
      )

    // First-of-pair strand
    case 4: {
      const isFirst = (flags & 64) !== 0
      const effectiveStrand = isFirst ? strand : -strand
      return strandColor(effectiveStrand, palette)
    }

    // Pair orientation
    case 5:
      return pairOrientationColor(data.readPairOrientations[i]!, palette)

    // Insert size + orientation (non-LR orientation wins, then insert size threshold)
    case 6: {
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

    // Modifications: fwd/rev strand tint
    case 7: {
      const isReverse = (flags & 16) !== 0
      return rgb255(
        isReverse ? palette.colorModificationRev : palette.colorModificationFwd,
      )
    }

    // Tag-based coloring
    case 8: {
      if (data.readTagColors.length > 0) {
        const packed = data.readTagColors[i]!
        if (packed !== 0) {
          return abgrToCssRgba(packed)
        }
      }
      return rgb255(palette.colorPairLR)
    }

    // Base quality: hsl(avgBaseQuality/360, 50%, 50%)
    case 9:
      return hslToRgbString(data.readAvgBaseQualities[i]! / 360, 0.5, 0.5)

    // Insert size (gradient)
    case 10: {
      const insertSize = data.readInsertSizes[i]!
      const stats = data.insertSizeStats
      if (stats && insertSize > stats.upper) {
        const t = Math.min((insertSize - stats.upper) / stats.upper, 1)
        return lerpRgb255(palette.colorPairLR, palette.colorLongInsert, t)
      }
      if (stats && insertSize < stats.lower) {
        const t = Math.min((stats.lower - insertSize) / stats.lower, 1)
        return lerpRgb255(palette.colorPairLR, palette.colorShortInsert, t)
      }
      return rgb255(palette.colorPairLR)
    }

    default:
      return rgb255(palette.colorPairLR)
  }
}

export function makeBasePalette(palette: ColorPalette) {
  return {
    A: palette.colorBaseA,
    C: palette.colorBaseC,
    G: palette.colorBaseG,
    T: palette.colorBaseT,
  } as Record<string, RGBColor>
}

export function getBaseColorString(
  base: string,
  basePalette: Record<string, RGBColor>,
  palette: ColorPalette,
) {
  return basePalette[base]
    ? rgb255(basePalette[base])
    : rgb255(palette.colorNostrand)
}

// Same as getBaseColorString but returns rgba() with the given alpha, so
// callers don't need ctx.globalAlpha bracketing.
export function getBaseColorStringWithAlpha(
  base: string,
  basePalette: Record<string, RGBColor>,
  palette: ColorPalette,
  alpha: number,
) {
  return rgba255(basePalette[base] ?? palette.colorNostrand, alpha)
}
