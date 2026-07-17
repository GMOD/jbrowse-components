import { abgrToCssRgba, normalizedRgbToCss } from '@jbrowse/core/util/colorBits'

import { ColorScheme } from './constants.ts'
import { COLOR_SCHEMES } from '../shared/colorSchemes.ts'
import { classifyInsertSize } from '../shared/insertSizeStats.ts'
import { IS_GRADIENT_SPAN_FRAC } from './shaders/slang/read.iface.generated.ts'

import type { LinkedReadsMode } from './constants.ts'
import type { ColorPalette, RGBColor } from './shaders/colors.ts'
import type { InsertSizeBand } from '../shared/insertSizeStats.ts'

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
  insertSizeStats?: InsertSizeBand
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
  | 'splitInversion'
  | 'splitDeletion'
  | 'unmappedMate'
  | 'interchrom'
  | 'fwdStrand'
  | 'revStrand'
  | 'noStrand'
  | 'nonSplit'
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

// po=0 means no computed pair orientation. Under the pairOrientation scheme the
// chained-supplementary (split) branch runs first, so a read that falls through
// to here is a non-split read (long single reads, or a pair with no orientation)
// — grey, distinct from the strand-colored split segments.
function pairOrientationCategory(po: number): ReadColorCategory {
  return pairOrientationCategories[po] ?? 'nonSplit'
}

// Map the shared insert-size class onto the render/legend category vocabulary.
// The threshold rule (including the unset-TLEN guard) lives in classifyInsertSize
// so this and the arc path (arcs/compute.ts) share one source; SYNC only the
// class→category naming here with insertSizeColor / isAndOrientColor in
// read.slang.
const insertClassCategory: Record<
  ReturnType<typeof classifyInsertSize>,
  ReadColorCategory
> = {
  long: 'longInsert',
  short: 'shortInsert',
  normal: 'normalInsert',
}

function insertSizeCategory(
  insertSize: number,
  stats: InsertSizeBand | undefined,
): ReadColorCategory {
  return insertClassCategory[classifyInsertSize(insertSize, stats)]
}

// Schemes whose color depends on pair orientation/insert size, so an unmapped
// mate (tlen=0) or inter-chromosomal mate needs its own bucket rather than a
// misleading "short insert"/orientation hue. Derived from the `mateAware` flag
// in the shared COLOR_SCHEMES registry (single source), mapped to shader
// indices. Module-level so the per-read classification in readColorCategory (a
// render + legend hot loop) does not reallocate this each call. SYNC: the shader
// twin `isOrientationScheme` (read.slang) hard-codes the same membership.
const orientationSchemes = new Set(
  Object.values(COLOR_SCHEMES)
    .filter(s => s.mateAware)
    .map(s => ColorScheme[s.shaderScheme]),
)

// Classify read `i` under the active color scheme. Precedence:
// opt-in paired-supplementary override → long-read-chain-supplementary strand
// framing → unmapped mate → inter-chromosomal → per-scheme bucket.
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
    colorSupplementaryChains?: boolean
  },
): ReadColorCategory {
  const flags = data.readFlags[i]!
  const strand = data.readStrands[i]!
  const isChain = opts?.linkedReads !== undefined && opts.linkedReads !== 'off'

  const chainSupp = data.readChainHasSupp?.[i] ?? 0
  const isPaired = (flags & 1) !== 0

  // Opt-in legacy behavior: paint paired supplementary chains a flat
  // supplementary color (hides the discordant-pair signal; off by default).
  // SYNC: mirror of the `u.colorSuppChains == 1` branch in read.slang.
  if (isChain && chainSupp > 0 && isPaired && opts.colorSupplementaryChains) {
    return 'supplementary'
  }

  // Long-read (unpaired) supplementary chains frame each segment's strand
  // against the primary, so an inversion at a split junction reads as a strand
  // flip. Paired supplementary chains otherwise keep their normal per-scheme
  // color (pair orientation, insert size, …): a flat override would hide the
  // discordant-pair signal, and the split is already shown by arcs/clip marks.
  if (isChain && chainSupp > 0 && !isPaired) {
    const primaryStrand = chainSupp > 1 ? -1 : 1
    const effectiveStrand =
      opts.flipStrandLongReadChains !== false ? strand * primaryStrand : strand
    return strandCategory(effectiveStrand)
  }

  // Paired split read whose supplementary segment maps opposite-strand to its
  // own primary mate (chainSupp === 3): the split crosses an inversion junction.
  // Under an orientation scheme, paint the whole chain a dedicated inversion hue,
  // distinct from the RR-pair blue so the two are tellable apart. Co-linear
  // paired splits keep their per-scheme pair-orientation color.
  // SYNC: mirror of the `chainHasSupp == 3u` branch in read.slang.
  if (
    isChain &&
    chainSupp === 3 &&
    isPaired &&
    (colorScheme === ColorScheme.pairOrientation ||
      colorScheme === ColorScheme.insertSizeAndOrientation)
  ) {
    return 'splitInversion'
  }

  // Same as above but for a same-strand (co-linear) split — a deletion / tandem-
  // dup junction. Its own color (the supplementary yellow), reserving magenta
  // for the more specific inversion case. SYNC: `chainHasSupp == 4u` in read.slang.
  if (
    isChain &&
    chainSupp === 4 &&
    isPaired &&
    (colorScheme === ColorScheme.pairOrientation ||
      colorScheme === ColorScheme.insertSizeAndOrientation)
  ) {
    return 'splitDeletion'
  }

  // unmapped mate (flag 8) — its own color for orientation-aware schemes (tlen=0
  // would miscolor as "short insert"), or normal scheme in linked-read mode.
  const mateUnmapped = (flags & 8) !== 0
  const isOrientationScheme = orientationSchemes.has(colorScheme)
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

    case ColorScheme.pairOrientation: {
      // Only SPLIT alignments show strand coloring (via the chained-supplementary
      // branch above). A read reaching here has no pair orientation and isn't a
      // split segment, so it's a non-split read → grey.
      return pairOrientationCategory(data.readPairOrientations[i]!)
    }

    // Short-insert pairs always show pink, even with abnormal orientation;
    // otherwise orientation wins, falling back to long-/normal-insert.
    case ColorScheme.insertSizeAndOrientation: {
      const insert = insertSizeCategory(
        data.readInsertSizes[i]!,
        data.insertSizeStats,
      )
      const po = data.readPairOrientations[i]!
      return insert === 'shortInsert'
        ? insert
        : po === 2 || po === 3 || po === 4
          ? pairOrientationCategory(po)
          : insert
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
// (normal) color toward the long/short endpoint by outlier severity. The ramp
// reaches full color IS_GRADIENT_SPAN_FRAC of the 6σ band past the threshold
// (≈3σ, i.e. center±6σ) so a moderate outlier already reads as clearly colored
// rather than near-neutral. SYNC: IS_GRADIENT_SPAN_FRAC and this math mirror
// insertSizeGradientColor in read.slang (the shader is the source of the const).
function gradientInsertColor(
  cat: 'longInsert' | 'shortInsert',
  insertSize: number,
  stats: InsertSizeBand | undefined,
  palette: ColorPalette,
) {
  const span = stats ? (stats.upper - stats.lower) * IS_GRADIENT_SPAN_FRAC : 0
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
    colorSupplementaryChains?: boolean
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
  // non-split read under the pair-orientation scheme: reuses the neutral grey,
  // but a distinct category so the legend can label it "Non-split read"
  nonSplit: 'colorNostrand',
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
  // dedicated inversion hue (colorSplitReadInversion), distinct from the RR-pair
  // blue so the legend swatch and read fill are unambiguous
  splitInversion: 'colorSplitInversion',
  // co-linear (deletion) split reuses the supplementary yellow — "ordinary split
  // read", with magenta reserved for the special inverted case
  splitDeletion: 'colorSupplementary',
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
