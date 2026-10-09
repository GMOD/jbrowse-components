import { SAM_FLAG_MATE_UNMAPPED, SAM_FLAG_PAIRED } from '@jbrowse/cigar-utils'
import { abgrToCssRgba, normalizedRgbToCss } from '@jbrowse/core/util/colorBits'

import {
  RC_FWD_STRAND,
  RC_INTERCHROM,
  RC_LONG_INSERT,
  RC_MAPQ,
  RC_MAPQ_UNAVAILABLE,
  RC_MOD_FWD,
  RC_MOD_REV,
  RC_NON_SPLIT,
  RC_NORMAL_INSERT,
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
  RC_TAG,
  RC_UNMAPPED_MATE,
} from '../shaders/slang/read.consts.generated.ts'
import { COLOR_SCHEMES } from '../shared/colorSchemes.ts'
import { pairCategory } from '../shared/pairCategory.ts'
import { MAPQ_CSS } from '../shared/qualityRamps.ts'
import {
  CHAIN_SPLIT_DELETION,
  CHAIN_SPLIT_INVERSION,
  CHAIN_SUPP_NONE,
  chainFrame,
  chainHasSupp,
  chainSplitKind,
} from '../shared/types.ts'
import { MAPQ_UNAVAILABLE, firstOfPairStrand } from '../shared/util.ts'

import type {
  ColorPalette,
  PaletteColorKey,
  PaletteColors,
  RGBColor,
} from '../shaders/colors.ts'
import type { InsertSizeBand } from '../shared/insertSizeStats.ts'
import type { ColorSchemeType, ShaderScheme } from '../shared/types.ts'

export const rgb255 = normalizedRgbToCss

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
// mirrored test.
export type ReadColorCategory =
  | 'splitInversion'
  | 'splitDeletion'
  | 'unmappedMate'
  | 'interchrom'
  | 'fwdStrand'
  | 'revStrand'
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
  | 'mapqUnavailable'
  | 'tag'
  | 'noTagValue'
  | 'modFwd'
  | 'modRev'

function strandCategory(strand: number): ReadColorCategory {
  return strand < 0 ? 'revStrand' : 'fwdStrand'
}

// Whether the unpaired chain-strand framing is live: an orientation field
// paints a split segment's strand against its molecule's, and only a chain has
// a molecule. The display asks once and hands the answer to the consensus
// pass, the bake (`ReadColorOpts`) and the key.
export function framesUnpairedChainStrand(
  colorScheme: ColorSchemeType,
  chainMode: boolean,
) {
  return chainMode && COLOR_SCHEMES[colorScheme].orientation === true
}

// Category → the shader's RC_* index. Built from the generated constants, so
// the GPU and this file cannot disagree on what an index means. Exhaustive by
// type: adding a ReadColorCategory member without an index fails to compile.
export const READ_COLOR_CATEGORY: Record<ReadColorCategory, number> = {
  splitInversion: RC_SPLIT_INVERSION,
  splitDeletion: RC_SPLIT_DELETION,
  unmappedMate: RC_UNMAPPED_MATE,
  interchrom: RC_INTERCHROM,
  fwdStrand: RC_FWD_STRAND,
  revStrand: RC_REV_STRAND,
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
  mapqUnavailable: RC_MAPQ_UNAVAILABLE,
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
  colorScheme: ColorSchemeType,
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
  framesChainStrand?: boolean
}

// Classify read `i` under the active color scheme: the cross-cutting override
// ladder first, then the scheme's own bucket.
//
// This is the ONLY implementation of that precedence. read.slang consumes the
// baked category (see buildReadColorCategories) and paints it; it no longer
// re-derives these rules, so there is nothing left to keep in sync.
export function readColorCategory(
  i: number,
  data: ReadColorData,
  colorScheme: ColorSchemeType,
  opts: ReadColorOpts = {},
): ReadColorCategory {
  return (
    overrideCategory(i, data, colorScheme, opts) ??
    schemeCategory(i, data, COLOR_SCHEMES[colorScheme].shaderScheme)
  )
}

// The levels a mate-aware field paints beyond the pair's own: a mate on
// another chromosome or none at all, and under an orientation field in a chain
// the split levels. `undefined` hands the read on to `schemeCategory`. Under
// any other field, and under a constant, a read paints its field's value.
//
// A paired split mate is framed against its own mate's primary, which
// `attachChainFields` resolved into CHAIN_SPLIT_*; an unpaired segment has no
// mate, so its strand against the chain's frame is the whole story. The frame
// is `consensusChainStrandFrames`'s, settled across the chains on screen
// because on a foldback the primary flag is arbitrary: read the bit, never
// re-derive it here.
function overrideCategory(
  i: number,
  data: ReadColorData,
  colorScheme: ColorSchemeType,
  opts: ReadColorOpts,
): ReadColorCategory | undefined {
  const { mateAware, orientation } = COLOR_SCHEMES[colorScheme]
  if (!mateAware) {
    return undefined
  }
  const flags = data.readFlags[i]!
  const chainSupp = data.readChainHasSupp?.[i] ?? CHAIN_SUPP_NONE
  const isPaired = (flags & SAM_FLAG_PAIRED) !== 0
  if (opts.framesChainStrand && chainHasSupp(chainSupp) && !isPaired) {
    return strandCategory(data.readStrands[i]! * chainFrame(chainSupp))
  }
  if (opts.chainMode && isPaired && orientation) {
    const splitKind = chainSplitKind(chainSupp)
    if (splitKind === CHAIN_SPLIT_INVERSION) {
      return 'splitInversion'
    }
    if (splitKind === CHAIN_SPLIT_DELETION) {
      return 'splitDeletion'
    }
  }
  // tlen=0 would read as a short insert, and across chromosomes neither
  // orientation nor insert size means anything
  if (flags & SAM_FLAG_MATE_UNMAPPED) {
    return 'unmappedMate'
  }
  return data.readInterchrom[i] === 1 ? 'interchrom' : undefined
}

// The scheme's own bucket, for a read no override claimed. Takes the SHADER
// path, the granularity a body fill has: chromosome painting is the 'tag' body
// with another value baked in. Exhaustive with no fallback, so a new path has to
// say what its body is.
function schemeCategory(
  i: number,
  data: ReadColorData,
  shaderScheme: ShaderScheme,
): ReadColorCategory {
  const flags = data.readFlags[i]!
  const strand = data.readStrands[i]!

  switch (shaderScheme) {
    case 'normal':
      return 'plain'

    case 'strand':
      return strandCategory(strand)

    // 255 is the SAM spec's "unavailable", not a score of 255 — and it is what
    // `getMappingQuality` returns for a feature carrying no mapping quality at
    // all (PAF/MashMap blocks without one). Split out so it takes the neutral
    // grey rather than the ramp's top.
    case 'mappingQuality':
      return data.readMapqs[i] === MAPQ_UNAVAILABLE ? 'mapqUnavailable' : 'mapq'

    // Fragment strand inferred from the first mate, through the shared rule
    // `firstOfPairStrandKey` (groupFeatures.ts) also calls — so the color a read
    // paints and the section it groups into agree by construction rather than by
    // two copies of the same arithmetic. The shader doesn't derive this at all.
    case 'firstOfPairStrand':
      return strandCategory(firstOfPairStrand(strand, flags))

    // The pair fields classify through the one function the arcs read too. A
    // read reaching here with no pair orientation is a non-split read or a
    // split one whose framing is off, and grey is the right answer for both.
    case 'insertSize':
    case 'pairOrientation':
    case 'insertSizeAndOrientation':
      return pairCategory(
        shaderScheme,
        data.readPairOrientations[i]!,
        data.readInsertSizes[i]!,
        data.insertSizeStats,
      )

    // The read's own strand decides which of the two modification hues it
    // paints; `strand` is already resolved above, so this asks the same field
    // every other branch of this switch does.
    case 'modifications':
      return strand === -1 ? 'modRev' : 'modFwd'

    case 'tag':
      // A read this scheme resolved no color for — the tag is absent, or under
      // chromosome painting the read has no mate — paints the palette fallback
      // (colorPairLR). Its own bucket, so the legend keys that neutral instead
      // of leaving it as the one painted color with no entry. Guarded on the
      // array being baked at all: until the main thread bakes it, it is empty
      // and every read is on the fallback for a different reason.
      return data.readTagColors.length > 0 && data.readTagColors[i] === 0
        ? 'noTagValue'
        : 'tag'
  }
}

// The one place a category becomes a CSS color. read.slang's
// `categoryPaletteColor` is the GPU twin, indexing the table `readCategoryColor`
// resolves.
function categoryColor(
  cat: ReadColorCategory,
  i: number,
  data: ReadColorData,
  palette: ColorPalette,
): string {
  switch (cat) {
    case 'mapq':
      return MAPQ_CSS[data.readMapqs[i]!]!
    case 'tag': {
      const packed = data.readTagColors[i]
      return packed
        ? abgrToCssRgba(packed)
        : rgb255(palette.readCategoryColors[cat])
    }
    default:
      return rgb255(palette.readCategoryColors[cat])
  }
}

// Canvas2D/SVG fill for a read whose category was already baked. The twin of
// read.slang's `getReadColor`, and like it, a painter rather than a classifier —
// both take the index out of the same `readColorCategories` array.
export function readColorFromCategoryIndex(
  categoryIndex: number,
  i: number,
  data: ReadColorData,
  palette: ColorPalette,
) {
  return categoryColor(
    READ_COLOR_CATEGORY_BY_INDEX[categoryIndex]!,
    i,
    data,
    palette,
  )
}

// Classify-then-paint in one call. Every render path goes through
// `readColorFromCategoryIndex` against the baked array instead, so the only
// caller left is colorUtils.test.ts — kept because it is the seam that checks
// the classifier and the painter agree end to end, which testing the two halves
// separately would not. (It used to say "the arcs legend" too; the arcs legend
// has its own category vocabulary and never called this.)
export function getReadColor(
  i: number,
  data: ReadColorData,
  colorScheme: ColorSchemeType,
  palette: ColorPalette,
  opts?: ReadColorOpts,
) {
  return categoryColor(
    readColorCategory(i, data, colorScheme, opts),
    i,
    data,
    palette,
  )
}

// The default color of each fixed-swatch category, a palette key. Keys repeat
// where categories share a default; the categories stay distinct, so each one
// takes a declared color on its own. `plain`, `mapq` and `tag` resolve per
// read and have no swatch.
export const swatchPaletteKeys = {
  fwdStrand: 'colorFwdStrand',
  revStrand: 'colorRevStrand',
  modFwd: 'colorModificationFwd',
  modRev: 'colorModificationRev',
  nonSplit: 'colorPairLR',
  pairLR: 'colorPairLR',
  pairRL: 'colorPairRL',
  pairRR: 'colorPairRR',
  pairLL: 'colorPairLL',
  normalInsert: 'colorPairLR',
  longInsert: 'colorLongInsert',
  shortInsert: 'colorShortInsert',
  interchrom: 'colorInterchrom',
  unmappedMate: 'colorUnmappedMate',
  splitInversion: 'colorSplitInversion',
  splitDeletion: 'colorSupplementary',
  noTagValue: 'colorPairLR',
  mapqUnavailable: 'colorPairLR',
} satisfies Partial<Record<ReadColorCategory, PaletteColorKey>>

export type SwatchCategory = keyof typeof swatchPaletteKeys

// Every category's default, the ones with no swatch included, which take the
// neutral fill where no per-read color reaches them.
export const readCategoryPaletteKeys = {
  ...swatchPaletteKeys,
  plain: 'colorPairLR',
  mapq: 'colorPairLR',
  tag: 'colorPairLR',
} satisfies Record<ReadColorCategory, PaletteColorKey>

// What each category paints: the color `declared` for it, else its default
// among `colors`.
export function readCategoryColorsOf(
  colors: PaletteColors,
  declared: Partial<Record<ReadColorCategory, RGBColor>> = {},
): Record<ReadColorCategory, RGBColor> {
  return Object.fromEntries(
    Object.entries(readCategoryPaletteKeys).map(([category, key]) => [
      category,
      declared[category as ReadColorCategory] ?? colors[key],
    ]),
  ) as Record<ReadColorCategory, RGBColor>
}

export function categorySwatchColor(
  category: SwatchCategory,
  palette: ColorPalette,
) {
  return rgb255(palette.readCategoryColors[category])
}

export { normalizedRgbToCssRgba as rgba255 } from '@jbrowse/core/util/colorBits'

// `rgba255`'s output up to the alpha, for a painter that resolves an alpha per
// instance: rejoined as `prefix + alpha + ')'` it is that string byte for byte,
// and it converts one number per instance where `rgba255` converts four. Worth
// 42 ms of a 100K-instance gap layer, which is most of what the layer costs.
// `colorUtils.test.ts` pins the two spellings together.
export function rgbaPrefix255(c: readonly [number, number, number]) {
  return `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},`
}
