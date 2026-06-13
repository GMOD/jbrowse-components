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

// The single classification of "what is this read" — one bucket per read that
// fully determines both its rendered color (categoryColor) and its legend
// swatch (CATEGORY_LEGEND in legendUtils). Because the renderer and the legend
// both flow through this, the legend can never list a color the renderer didn't
// paint (or omit one it did): they are correct by construction, not by a
// mirrored test. Members that are dynamic ramps/palettes rather than a fixed
// swatch ('mapq', 'tag', 'modFwd'/'modRev', 'plain') get no legend entry.
export type ReadColorCategory =
  | 'supplementary'
  | 'unmappedMate'
  | 'interchrom'
  | 'fwdStrand'
  | 'revStrand'
  | 'noStrand'
  | 'pairLR'
  | 'pairRL'
  | 'pairRR'
  | 'pairLL'
  | 'longInsert'
  | 'shortInsert'
  | 'normalInsert'
  | 'plain'
  | 'mapq'
  | 'tag'
  | 'modFwd'
  | 'modRev'

function strandCategory(strand: number): ReadColorCategory {
  return strand > 0 ? 'fwdStrand' : strand < 0 ? 'revStrand' : 'noStrand'
}

const pairOrientationCategories: Record<number, ReadColorCategory> = {
  1: 'pairLR',
  2: 'pairRL',
  3: 'pairRR',
  4: 'pairLL',
}

function pairOrientationCategory(po: number): ReadColorCategory {
  return pairOrientationCategories[po] ?? 'noStrand'
}

function insertSizeCategory(
  insertSize: number,
  stats: { upper: number; lower: number } | undefined,
): ReadColorCategory {
  return stats && insertSize > stats.upper
    ? 'longInsert'
    : stats && insertSize < stats.lower
      ? 'shortInsert'
      : 'normalInsert'
}

// Classify read `i` under the active color scheme. Precedence:
// chain-supplementary → unmapped mate → inter-chromosomal → per-scheme bucket.
//
// SYNC: `getReadColor` in shaders/slang/read.slang is the GPU twin and must
// reproduce this exact precedence (it's the path most users see; this JS path
// is the Canvas2D/SVG fallback + the legend's source). Scheme indices are the
// one thing already shared by construction — the CS_* export-consts in
// read.slang generate read.generated.ts, which builds the ColorScheme map. The
// precedence/per-scheme rules below are hand-mirrored: change both together.
export function readColorCategory(
  i: number,
  data: ReadColorData,
  colorScheme: number,
  opts?: {
    linkedReads?: LinkedReadsMode
    flipStrandLongReadChains?: boolean
  },
): ReadColorCategory {
  const flags = data.readFlags[i]!
  const strand = data.readStrands[i]!
  const isChain = opts?.linkedReads !== undefined && opts.linkedReads !== 'off'

  // In chain/linked-read mode, supplementary chains use one distinct color for
  // paired-end reads; long-read supplementary fall back to (oriented) strand.
  const chainSupp = data.readChainHasSupp?.[i] ?? 0
  if (isChain && chainSupp > 0) {
    if ((flags & 1) !== 0) {
      return 'supplementary'
    }
    const primaryStrand = chainSupp > 1 ? -1 : 1
    const effectiveStrand =
      opts.flipStrandLongReadChains !== false ? strand * primaryStrand : strand
    return strandCategory(effectiveStrand)
  }

  // unmapped mate (flag 8) — its own color for orientation-aware schemes (tlen=0
  // would miscolor as "short insert"), or normal scheme in linked-read mode.
  const mateUnmapped = (flags & 8) !== 0
  const isOrientationScheme = (
    [
      ColorScheme.insertSize,
      ColorScheme.pairOrientation,
      ColorScheme.insertSizeAndOrientation,
      ColorScheme.insertSizeGradient,
    ] as number[]
  ).includes(colorScheme)
  if (
    mateUnmapped &&
    (isOrientationScheme || (colorScheme === ColorScheme.normal && isChain))
  ) {
    return 'unmappedMate'
  }

  // Mate on another chromosome: orientation/insert size are meaningless, so one
  // distinct bucket instead of an LR/RL/etc hue (mirrors read.slang).
  if (data.readInterchrom[i] === 1 && isOrientationScheme) {
    return 'interchrom'
  }

  switch (colorScheme) {
    case ColorScheme.normal:
      return 'plain'

    case ColorScheme.strand:
      return strandCategory(strand)

    case ColorScheme.mappingQuality:
      return 'mapq'

    // insertSizeGradient lerps its fill but buckets identically; categoryColor
    // applies the gradient when the scheme calls for it.
    case ColorScheme.insertSize:
    case ColorScheme.insertSizeGradient:
      return insertSizeCategory(data.readInsertSizes[i]!, data.insertSizeStats)

    case ColorScheme.firstOfPairStrand: {
      // Fragment strand inferred from the first mate: read2 (0x80) reports the
      // opposite of the fragment, so invert only it. Read1 and single-end reads
      // represent the fragment strand directly (must match firstOfPairStrandKey
      // in groupFeatures.ts and firstOfPairColor in read.slang).
      const isSecond = (flags & 128) !== 0
      return strandCategory(isSecond ? -strand : strand)
    }

    case ColorScheme.pairOrientation:
      return pairOrientationCategory(data.readPairOrientations[i]!)

    // Non-LR orientation wins; otherwise fall back to insert-size threshold.
    case ColorScheme.insertSizeAndOrientation: {
      const po = data.readPairOrientations[i]!
      if (po === 2 || po === 3 || po === 4) {
        return pairOrientationCategory(po)
      }
      return insertSizeCategory(data.readInsertSizes[i]!, data.insertSizeStats)
    }

    case ColorScheme.modifications:
      return (flags & 16) !== 0 ? 'modRev' : 'modFwd'

    case ColorScheme.tag:
      return 'tag'

    default:
      return 'plain'
  }
}

// Gradient fill for the insert-size-gradient scheme: lerp from the neutral
// (normal) color toward the long/short endpoint by outlier severity. Span = 6σ
// (upper−lower), so the gradient saturates at ~9σ from the mean.
function gradientInsertColor(
  cat: 'longInsert' | 'shortInsert',
  insertSize: number,
  stats: { upper: number; lower: number } | undefined,
  palette: ColorPalette,
) {
  const span = stats ? stats.upper - stats.lower : 0
  if (stats && span > 0) {
    return cat === 'longInsert'
      ? lerpRgb255(
          palette.colorPairLR,
          palette.colorLongInsert,
          Math.min((insertSize - stats.upper) / span, 1),
        )
      : lerpRgb255(
          palette.colorPairLR,
          palette.colorShortInsert,
          Math.min((stats.lower - insertSize) / span, 1),
        )
  }
  return rgb255(palette.colorPairLR)
}

// The one place a category becomes a CSS color. The dynamic categories
// (computed per-read or per-scheme) are handled explicitly; everything else is
// a flat swatch resolved through the same `swatchPaletteKeys` table the legend
// uses (categorySwatchColor), so the flat category→palette mapping has a single
// home. The `default` narrows to SwatchCategory, so a newly added *dynamic*
// category fails to compile until it gets a case here.
//
// SYNC: the color helpers in read.slang (strandColor / insertSizeColor /
// insertSizeGradientColor / pairOrientColor / modificationsColor / mapq hue)
// are the GPU twins of these per-category colors — keep the two in sync.
function categoryColor(
  cat: ReadColorCategory,
  i: number,
  data: ReadColorData,
  colorScheme: number,
  palette: ColorPalette,
): string {
  switch (cat) {
    case 'plain':
      return rgb255(palette.colorPairLR)
    case 'mapq':
      // hue = mapq degrees (0–255), browser native hsl() is fastest
      return `hsl(${data.readMapqs[i]},50%,50%)`
    case 'modFwd':
      return rgb255(palette.colorModificationFwd)
    case 'modRev':
      return rgb255(palette.colorModificationRev)
    case 'tag': {
      const packed = data.readTagColors[i]
      return packed ? abgrToCssRgba(packed) : rgb255(palette.colorPairLR)
    }
    // insertSizeGradient lerps the two insert-size bands; under any other scheme
    // they (and 'normalInsert') fall through to the flat swatch lookup.
    case 'longInsert':
    case 'shortInsert':
      return colorScheme === ColorScheme.insertSizeGradient
        ? gradientInsertColor(
            cat,
            data.readInsertSizes[i]!,
            data.insertSizeStats,
            palette,
          )
        : categorySwatchColor(cat, palette)
    default:
      return categorySwatchColor(cat, palette)
  }
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
  return categoryColor(
    readColorCategory(i, data, colorScheme, opts),
    i,
    data,
    colorScheme,
    palette,
  )
}

// Palette key backing each fixed-swatch category, so the legend swatch is the
// exact color the renderer paints. The keys form `SwatchCategory` — the subset
// of categories that render as a single flat color; dynamic categories
// (mapq/tag/mod/plain) have no single swatch and are absent here.
const swatchPaletteKeys = {
  fwdStrand: 'colorFwdStrand',
  revStrand: 'colorRevStrand',
  noStrand: 'colorNostrand',
  pairLR: 'colorPairLR',
  pairRL: 'colorPairRL',
  pairRR: 'colorPairRR',
  pairLL: 'colorPairLL',
  normalInsert: 'colorPairLR',
  longInsert: 'colorLongInsert',
  shortInsert: 'colorShortInsert',
  interchrom: 'colorInterchrom',
  unmappedMate: 'colorUnmappedMate',
  supplementary: 'colorSupplementary',
} satisfies Partial<Record<ReadColorCategory, keyof ColorPalette>>

export type SwatchCategory = keyof typeof swatchPaletteKeys

// CSS color of a fixed-swatch category, straight from the live palette.
export function categorySwatchColor(
  category: SwatchCategory,
  palette: ColorPalette,
) {
  return rgb255(palette[swatchPaletteKeys[category]])
}

export { normalizedRgbToCssRgba as rgba255 } from '@jbrowse/core/util/colorBits'
