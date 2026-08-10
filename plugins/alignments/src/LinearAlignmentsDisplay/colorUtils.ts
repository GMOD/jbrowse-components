import {
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
} from '@jbrowse/alignments-core'
import { abgrToCssRgba, normalizedRgbToCss } from '@jbrowse/core/util/colorBits'

import {
  RC_FWD_STRAND,
  RC_INTERCHROM,
  RC_LONG_INSERT,
  RC_MAPQ,
  RC_MOD_FWD,
  RC_MOD_REV,
  RC_NON_SPLIT,
  RC_NORMAL_INSERT,
  RC_NO_STRAND,
  RC_NO_TAG_VALUE,
  RC_PAIR_LL,
  RC_PAIR_LR,
  RC_PAIR_RL,
  RC_PAIR_RR,
  RC_PLAIN,
  RC_REV_STRAND,
  RC_SHORT_INSERT,
  RC_SPLIT_DELETION,
  RC_SPLIT_INVERSION,
  RC_SUPPLEMENTARY,
  RC_TAG,
  RC_UNMAPPED_MATE,
} from '../shaders/slang/read.iface.generated.ts'
import { insertGradientT } from '../shaders/slang/read.js.generated.ts'
import { COLOR_SCHEMES } from '../shared/colorSchemes.ts'
import { classifyInsertSize } from '../shared/insertSizeStats.ts'
import {
  CHAIN_FILL_NO_SUPP,
  CHAIN_FILL_SPLIT_DELETION,
  CHAIN_FILL_SPLIT_INVERSION,
  CHAIN_FILL_SUPP_PRIMARY_FWD,
} from '../shared/types.ts'
import { firstOfPairStrand } from '../shared/util.ts'
import { ColorScheme } from './constants.ts'

import type { ColorPalette, RGBColor } from '../shaders/colors.ts'
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
  | 'noTagValue'
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
// so this and the arc path (arcs/compute.ts) share one source. The shader
// used to re-apply those thresholds; it now receives the resulting category,
// so this naming has no GPU twin to stay in step with.
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
// render + legend hot loop) does not reallocate this each call. The registry is
// now the only source — read.slang used to mirror this membership as a bitmask
// for its own classification, and no longer classifies at all.
export const orientationSchemes = new Set(
  Object.values(COLOR_SCHEMES)
    .filter(s => s.mateAware)
    .map(s => ColorScheme[s.shaderScheme]),
)

// Category → the shader's RC_* index. Built from the generated constants, so
// the GPU and this file cannot disagree on what an index means. Exhaustive by
// type: adding a ReadColorCategory member without an index fails to compile.
export const READ_COLOR_CATEGORY: Record<ReadColorCategory, number> = {
  supplementary: RC_SUPPLEMENTARY,
  splitInversion: RC_SPLIT_INVERSION,
  splitDeletion: RC_SPLIT_DELETION,
  unmappedMate: RC_UNMAPPED_MATE,
  interchrom: RC_INTERCHROM,
  fwdStrand: RC_FWD_STRAND,
  revStrand: RC_REV_STRAND,
  noStrand: RC_NO_STRAND,
  nonSplit: RC_NON_SPLIT,
  pairLR: RC_PAIR_LR,
  pairRL: RC_PAIR_RL,
  pairRR: RC_PAIR_RR,
  pairLL: RC_PAIR_LL,
  longInsert: RC_LONG_INSERT,
  shortInsert: RC_SHORT_INSERT,
  normalInsert: RC_NORMAL_INSERT,
  plain: RC_PLAIN,
  mapq: RC_MAPQ,
  tag: RC_TAG,
  noTagValue: RC_NO_TAG_VALUE,
  modFwd: RC_MOD_FWD,
  modRev: RC_MOD_REV,
}

// Reverse of READ_COLOR_CATEGORY, for consumers holding a baked index (the
// legend's bucket scan, the Canvas2D fill).
export const READ_COLOR_CATEGORY_BY_INDEX = Object.entries(
  READ_COLOR_CATEGORY,
).reduce<ReadColorCategory[]>((acc, [name, idx]) => {
  acc[idx] = name as ReadColorCategory
  return acc
}, [])

// Classify every read once, into the shader's RC_* index space. This is THE
// classification pass: the GPU uploads the result as `inst.colorCategory`, the
// Canvas2D/SVG fallback reads it for its fill, and the legend scans it for the
// buckets to list. Because all three consume one array, a precedence change
// lands everywhere at once — the old arrangement re-derived the same rules in
// read.slang and drifted silently between backends.
export function buildReadColorCategories(
  data: ReadColorData,
  colorScheme: number,
  opts?: ReadColorOpts,
): Uint8Array {
  const n = data.readFlags.length
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = READ_COLOR_CATEGORY[readColorCategory(i, data, colorScheme, opts)]
  }
  return out
}

export interface ReadColorOpts {
  chainMode?: boolean
  flipStrandLongReadChains?: boolean
  colorSupplementaryChains?: boolean
}

// Classify read `i` under the active color scheme. Precedence:
// opt-in paired-supplementary override → long-read-chain-supplementary strand
// framing → unmapped mate → inter-chromosomal → per-scheme bucket.
//
// This is the ONLY implementation of that precedence. read.slang consumes the
// baked category (see buildReadColorCategories) and paints it; it no longer
// re-derives these rules, so there is nothing left to keep in sync.
// Defaults are declared once, here in the signature, rather than at each read:
// `flipStrandLongReadChains` mirrors its config-slot default (true), and the
// other two are off. Destructured rather than kept as an `opts?` object because
// the chain branches below read the fields unguarded — that only type-checked
// via TypeScript narrowing `opts` non-null through the aliased `isChain`
// condition, so moving or rewording that one `const` would silently have made
// them unsafe dereferences.
export function readColorCategory(
  i: number,
  data: ReadColorData,
  colorScheme: number,
  {
    chainMode: isChain = false,
    flipStrandLongReadChains = true,
    colorSupplementaryChains = false,
  }: ReadColorOpts = {},
): ReadColorCategory {
  const flags = data.readFlags[i]!
  const strand = data.readStrands[i]!

  const chainSupp = data.readChainHasSupp?.[i] ?? CHAIN_FILL_NO_SUPP
  const hasSupp = chainSupp !== CHAIN_FILL_NO_SUPP
  const isPaired = (flags & SAM_FLAG_PAIRED) !== 0
  // Both split markers only apply to paired chains, and only under a scheme that
  // encodes orientation — otherwise the split hue would displace the scheme the
  // user picked (insert size, tag, modifications).
  const splitsUnderOrientationScheme =
    isChain &&
    isPaired &&
    (colorScheme === ColorScheme.pairOrientation ||
      colorScheme === ColorScheme.insertSizeAndOrientation)

  // Opt-in legacy behavior: paint paired supplementary chains a flat
  // supplementary color (hides the discordant-pair signal; off by default).
  if (isChain && hasSupp && isPaired && colorSupplementaryChains) {
    return 'supplementary'
  }

  // Long-read (unpaired) supplementary chains frame each segment's strand
  // against the primary, so an inversion at a split junction reads as a strand
  // flip. Paired supplementary chains otherwise keep their normal per-scheme
  // color (pair orientation, insert size, …): a flat override would hide the
  // discordant-pair signal, and the split is already shown by arcs/clip marks.
  if (isChain && hasSupp && !isPaired) {
    // Only reachable with chainSupp 1 or 2 — buildChainMetadata writes the
    // split markers (3/4) for paired chains only.
    const primaryStrand = chainSupp > CHAIN_FILL_SUPP_PRIMARY_FWD ? -1 : 1
    return strandCategory(
      flipStrandLongReadChains ? strand * primaryStrand : strand,
    )
  }

  // Paired split read whose supplementary segment maps opposite-strand to its
  // own primary mate: the split crosses an inversion junction. Paint the whole
  // chain a dedicated inversion hue, distinct from the RR-pair blue so the two
  // are tellable apart. Co-linear paired splits keep their per-scheme
  // pair-orientation color.
  if (
    splitsUnderOrientationScheme &&
    chainSupp === CHAIN_FILL_SPLIT_INVERSION
  ) {
    return 'splitInversion'
  }

  // Same as above but for a same-strand (co-linear) split — a deletion / tandem-
  // dup junction. Its own color (the supplementary yellow), reserving magenta
  // for the more specific inversion case.
  if (splitsUnderOrientationScheme && chainSupp === CHAIN_FILL_SPLIT_DELETION) {
    return 'splitDeletion'
  }

  // unmapped mate — its own color for orientation-aware schemes (tlen=0
  // would miscolor as "short insert"), or normal scheme in linked-read mode.
  const mateUnmapped = (flags & SAM_FLAG_MATE_UNMAPPED) !== 0
  const isOrientationScheme = orientationSchemes.has(colorScheme)
  if (
    mateUnmapped &&
    (isOrientationScheme || (colorScheme === ColorScheme.normal && isChain))
  ) {
    return 'unmappedMate'
  }

  // Mate on another chromosome: orientation/insert size are meaningless, so one
  // distinct bucket instead of an LR/RL/etc hue.
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

    // Fragment strand inferred from the first mate, through the shared rule
    // `firstOfPairStrandKey` (groupFeatures.ts) also calls — so the color a read
    // paints and the section it groups into agree by construction rather than by
    // two copies of the same arithmetic. The shader doesn't derive this at all.
    case ColorScheme.firstOfPairStrand:
      return strandCategory(firstOfPairStrand(strand, flags))

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

    // The read's own strand decides which of the two modification hues it
    // paints; `strand` is already resolved above, so this asks the same field
    // every other branch of this switch does.
    case ColorScheme.modifications:
      return strand === -1 ? 'modRev' : 'modFwd'

    case ColorScheme.tag:
      // A read this scheme resolved no color for — the tag is absent, or under
      // chromosome painting the read has no mate — paints the palette fallback
      // (colorPairLR). Its own bucket, so the legend keys that neutral instead
      // of leaving it as the one painted color with no entry. Guarded on the
      // array being baked at all: until the main thread bakes it, it is empty
      // and every read is on the fallback for a different reason.
      return data.readTagColors.length > 0 && data.readTagColors[i] === 0
        ? 'noTagValue'
        : 'tag'

    default:
      return 'plain'
  }
}

// Gradient fill for the insert-size-gradient scheme: lerp from the neutral
// (normal) color toward the long/short endpoint by outlier severity. The ramp
// position is the shader's own — `insertGradientT` is generated from read.slang
// (adr-051), where it reaches full color IS_GRADIENT_SPAN_FRAC of the 6σ band
// past the threshold (≈3σ, i.e. center±6σ) so a moderate outlier already reads
// as clearly colored rather than near-neutral. A degenerate band gives t=0,
// which lerps to the neutral color the explicit guard here used to return.
// `stats` is required, not optional: this is only reachable for the longInsert /
// shortInsert categories, and classifyInsertSize can only produce those from a
// defined band.
function gradientInsertColor(
  cat: 'longInsert' | 'shortInsert',
  insertSize: number,
  stats: InsertSizeBand,
  palette: ColorPalette,
) {
  const isLong = cat === 'longInsert'
  return lerpRgb255(
    palette.colorPairLR,
    isLong ? palette.colorLongInsert : palette.colorShortInsert,
    insertGradientT(insertSize, stats.lower, stats.upper, isLong),
  )
}

// The one place a category becomes a CSS color. The dynamic categories
// (computed per-read or per-scheme) are handled explicitly; everything else is
// a flat swatch resolved through the same `swatchPaletteKeys` table the legend
// uses (categorySwatchColor), so the flat category→palette mapping has a single
// home. The `default` narrows to SwatchCategory, so a newly added *dynamic*
// category fails to compile until it gets a case here.
//
// read.slang's `categoryPaletteColor` is the GPU twin, but a flat table rather
// than a mirrored rule set, and colorCategory.test.ts machine-compares the two
// via `swatchPaletteKeys` — so this is checked, not a SYNC promise.
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
      return colorScheme === ColorScheme.insertSizeGradient &&
        data.insertSizeStats
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

// Canvas2D/SVG fill for a read whose category was already baked. The twin of
// read.slang's `getReadColor`, and like it, a painter rather than a classifier —
// both take the index out of the same `readColorCategories` array.
export function readColorFromCategoryIndex(
  categoryIndex: number,
  i: number,
  data: ReadColorData,
  colorScheme: number,
  palette: ColorPalette,
) {
  return categoryColor(
    READ_COLOR_CATEGORY_BY_INDEX[categoryIndex]!,
    i,
    data,
    colorScheme,
    palette,
  )
}

// Classify-then-paint, for callers with no baked array (the arcs legend, tests).
// The render paths go through readColorFromCategoryIndex instead.
export function getReadColor(
  i: number,
  data: ReadColorData,
  colorScheme: number,
  palette: ColorPalette,
  opts?: ReadColorOpts,
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
export const swatchPaletteKeys = {
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
  // read a CPU-baked scheme resolved no color for: the shader's tagColor==0
  // fallback, which is the same neutral 'plain' paints
  noTagValue: 'colorPairLR',
} satisfies Partial<Record<ReadColorCategory, keyof ColorPalette>>

export type SwatchCategory = keyof typeof swatchPaletteKeys

// Palette key backing EVERY category, including the ones with no legend swatch.
// This is what the GPU uploads into `u.readCategoryColor`, one slot per RC_*
// index, so the shader can index instead of branching — and so the color a
// category is painted and the color its swatch shows come from one table rather
// than from a shader chain checked against this one by a test.
//
// The four dynamic categories resolve per read (an hsl() of the mapq, a packed
// tag color) and never reach the uploaded table; they take the neutral fill so
// the slot holds a sane color rather than whatever the last block render left,
// which is also what the shader's own tagColor==0 path paints.
export const readCategoryPaletteKeys = {
  ...swatchPaletteKeys,
  plain: 'colorPairLR',
  modFwd: 'colorModificationFwd',
  modRev: 'colorModificationRev',
  mapq: 'colorPairLR',
  tag: 'colorPairLR',
} satisfies Record<ReadColorCategory, keyof ColorPalette>

// CSS color of a fixed-swatch category, straight from the live palette.
export function categorySwatchColor(
  category: SwatchCategory,
  palette: ColorPalette,
) {
  return rgb255(palette[swatchPaletteKeys[category]])
}

export { normalizedRgbToCssRgba as rgba255 } from '@jbrowse/core/util/colorBits'
