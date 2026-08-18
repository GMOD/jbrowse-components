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
} from '../shaders/slang/read.consts.generated.ts'
import { COLOR_SCHEMES } from '../shared/colorSchemes.ts'
import { classifyInsertSize } from '../shared/insertSizeStats.ts'
import {
  CHAIN_FILL_NO_SUPP,
  CHAIN_FILL_SPLIT_DELETION,
  CHAIN_FILL_SPLIT_INVERSION,
  CHAIN_FILL_SUPP_PRIMARY_REV,
} from '../shared/types.ts'
import { MAPQ_UNAVAILABLE, firstOfPairStrand } from '../shared/util.ts'
import { ColorScheme } from './constants.ts'

import type { ColorPalette } from '../shaders/colors.ts'
import type { InsertSizeBand } from '../shared/insertSizeStats.ts'

// Re-exports from core — kept for backwards-compat with call sites.
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
  | 'mapqUnavailable'
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
// so this and the arc path (arcs/arcColors.ts) share one source. The shader
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

// Schemes whose read fill is a per-read DATUM — a MAPQ ramp, a tag palette slot,
// a modification hue — rather than the alignment's own geometry. They are
// exactly the categories `categoryColor` resolves per read instead of through
// `swatchPaletteKeys`, which is the same distinction seen from the painting end.
//
// The chain supplementary framing below repaints a whole read, so over one of
// these it answers a different question than the one the user asked: picking
// "Tag (HP)" in chain mode painted every long read whose chain has a
// supplementary segment fwd/rev grey-red instead of its haplotype colour — on
// exactly the split reads at an SV that the mode exists to show. The paired
// split markers already state this rule as `splitsUnderOrientationScheme`; this
// is the unpaired half of it, and everything left out (normal, strand, insert
// size, orientation) is geometry that the framing refines rather than displaces.
const dataFillSchemes = new Set([
  ColorScheme.mappingQuality,
  ColorScheme.tag,
  ColorScheme.modifications,
])

// Whether the unpaired chain-strand framing below is actually going to be read,
// which is the gate on running `consensusChainStrandFrames` at all — that pass
// rewrites the very marker the framing reads, so under a scheme or a tickbox
// that discards the framing it would be work whose result nothing looks at.
// Every condition here is one of the branch's own, spelled once so the two
// cannot drift; the default for `flipStrandLongReadChains` mirrors the
// destructuring default in `readColorCategory`.
export function framesUnpairedChainStrand(
  colorScheme: number,
  {
    chainMode = false,
    flipStrandLongReadChains = true,
    colorSupplementaryChains = false,
  }: ReadColorOpts = {},
) {
  return (
    chainMode &&
    flipStrandLongReadChains &&
    !colorSupplementaryChains &&
    !dataFillSchemes.has(colorScheme)
  )
}

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

  // Three overrides can repaint a chain that carries a supplementary segment,
  // and they are one ladder rather than three independent rules:
  //
  //   1. orange (opt-in) — "don't classify the split, just mark the chain". The
  //      user asked for it explicitly, so it outranks both classifiers and every
  //      scheme.
  //   2. the unpaired classifier — the red/blue strand framing below.
  //   3. the paired classifier — the magenta/yellow split markers further down.
  //
  // 2 and 3 are scoped to opposite data because a pair HAS a richer answer: a
  // supplementary framed against its own mate's primary is an inversion or a
  // deletion junction, which `buildChainMetadata` already resolved into
  // CHAIN_FILL_SPLIT_*. An unpaired read has no mate to frame against, so the
  // strand flip is the whole story. 1 is scoped to neither, and used to be
  // paired-only purely because it was added to restore what a paired-only change
  // removed (5b8aa129d9) — on long reads the tickbox then did nothing at all,
  // which is the one kind of setting this menu must not have.
  if (isChain && hasSupp && colorSupplementaryChains) {
    return 'supplementary'
  }

  // Long-read (unpaired) supplementary chains frame each segment's strand
  // against the chain's frame: a segment agreeing with it is forward-red and one
  // that flipped at the split junction goes reverse-blue, so an inversion reads
  // as a colour flip rather than as something to look up.
  //
  // The frame itself is NOT this file's to decide, and used to be — it was the
  // chain's own primary strand, which a foldback makes arbitrary (both arms are
  // candidates for "longest alignment", so the flag lands on whichever the read
  // happened to cover more of, and the colours flip with it). It is now settled
  // across chains by `consensusChainStrandFrames`, which rewrites this same
  // marker before the bake. Read the marker; don't re-derive a frame here.
  //
  // Held off the data-carrying schemes (`dataFillSchemes`) so it refines the
  // fill rather than replacing it, and off entirely when the user unticks
  // `flipStrandLongReadChains` — its checkbox says "color supplementary
  // alignments by consensus strand", and unticking it used to keep colouring
  // them by strand, just unframed, which under `strand` (the one scheme it was
  // ever tested against) is indistinguishable from having no effect at all.
  // `framesUnpairedChainStrand` restates these four conditions for the consensus
  // pass, which must not run where they don't hold.
  if (
    isChain &&
    hasSupp &&
    !isPaired &&
    flipStrandLongReadChains &&
    !dataFillSchemes.has(colorScheme)
  ) {
    // Names the one code that means "reverse" instead of testing `> FWD`. The
    // magnitude form was correct only under "unreachable with the split markers
    // 3/4, which buildChainMetadata writes for paired chains only" — and that
    // rests on `summarizeChain`'s `paired` (ANY read of the chain is paired)
    // agreeing with this branch's `!isPaired` (THIS read is not), which two
    // records sharing a QNAME across a paired and an unpaired run do not. Under
    // the ordering test such a read claimed a reverse primary and painted its
    // strand framing inverted; naming the code makes an unexpected marker fall
    // to the unframed +1 instead, which is what "we don't know" should look
    // like. Identical for 1 and 2, which is every real chain.
    const chainFrame = chainSupp === CHAIN_FILL_SUPP_PRIMARY_REV ? -1 : 1
    return strandCategory(strand * chainFrame)
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
  // dup junction. Its own color (the supplementary orange), reserving magenta
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

    // 255 is the SAM spec's "unavailable", not a score of 255 — and it is what
    // `getMappingQuality` returns for a feature carrying no mapping quality at
    // all (PAF/MashMap blocks without one). Split out so it takes the neutral
    // grey rather than a hue the ramp's legend never names.
    case ColorScheme.mappingQuality:
      return data.readMapqs[i] === MAPQ_UNAVAILABLE ? 'mapqUnavailable' : 'mapq'

    case ColorScheme.insertSize:
      return insertSizeCategory(data.readInsertSizes[i]!, data.insertSizeStats)

    // Fragment strand inferred from the first mate, through the shared rule
    // `firstOfPairStrandKey` (groupFeatures.ts) also calls — so the color a read
    // paints and the section it groups into agree by construction rather than by
    // two copies of the same arithmetic. The shader doesn't derive this at all.
    case ColorScheme.firstOfPairStrand:
      return strandCategory(firstOfPairStrand(strand, flags))

    case ColorScheme.pairOrientation: {
      // A split alignment normally shows strand coloring instead, via the
      // chained-supplementary branch above; a read reaching here with no pair
      // orientation is either a non-split read or a split one whose framing the
      // user turned off, and grey is the right answer for both.
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

    // Unreachable: `colorScheme` is always `ColorScheme[shaderScheme]`, which
    // COLOR_SCHEMES makes total over the ten ShaderScheme names, and every one
    // of them has a case above. Kept because the parameter is a bare `number`
    // and TypeScript can't be told otherwise — not because any scheme falls
    // through to it.
    default:
      return 'plain'
  }
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

// Classify-then-paint in one call. Every render path goes through
// `readColorFromCategoryIndex` against the baked array instead, so the only
// caller left is colorUtils.test.ts — kept because it is the seam that checks
// the classifier and the painter agree end to end, which testing the two halves
// separately would not. (It used to say "the arcs legend" too; the arcs legend
// has its own category vocabulary and never called this.)
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
  noStrand: 'colorNeutralRead',
  // non-split read under the pair-orientation scheme: reuses the neutral grey,
  // but a distinct category so the legend can label it "Non-split read"
  nonSplit: 'colorNeutralRead',
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
  // co-linear (deletion) split reuses the supplementary orange — "ordinary split
  // read", with magenta reserved for the special inverted case
  splitDeletion: 'colorSupplementary',
  // read a CPU-baked scheme resolved no color for: the shader's tagColor==0
  // fallback, which is the same neutral 'plain' paints
  noTagValue: 'colorPairLR',
  // MAPQ 255 = "unavailable". The same grey `noStrand` uses for an unknown
  // strand, and for the same reason: the answer is missing, not extreme.
  mapqUnavailable: 'colorNeutralRead',
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
