import { SimpleFeature } from '@jbrowse/core/util'

import { partitionFeatures } from '../shared/groupFeatures.ts'
import { getReadColor, readColorCategory, rgb255 } from './colorUtils.ts'
import { ColorScheme } from './constants.ts'
import { makeTestPalette } from './testUtils.ts'

import type { RGBColor } from '../shaders/colors.ts'

// Distinct colors only for the roles these cases assert on, so a mis-mapped
// category resolves to a different (zeroed) color and the test catches it.
function c(n: number): RGBColor {
  return [n / 255, 0, 0]
}
const palette = makeTestPalette({
  colorRevStrand: c(2),
  colorPairLR: c(4),
  colorLongInsert: c(8),
  colorSupplementary: c(10),
})

interface ReadSpec {
  strand?: number
  flags?: number
  mapq?: number
  insertSize?: number
  pairOrientation?: number
  tagColor?: number
  chainHasSupp?: number
  interchrom?: number
}

// One-read data object so each case reads as a single read in isolation.
function makeData(
  spec: ReadSpec,
  insertSizeStats?: { upper: number; lower: number },
) {
  return {
    readStrands: Int8Array.of(spec.strand ?? 1),
    readFlags: Uint16Array.of(spec.flags ?? 0),
    readMapqs: Uint8Array.of(spec.mapq ?? 0),
    readInsertSizes: Float32Array.of(spec.insertSize ?? 0),
    readPairOrientations: Uint8Array.of(spec.pairOrientation ?? 0),
    readTagColors: Uint32Array.of(spec.tagColor ?? 0),
    readChainHasSupp: Uint8Array.of(spec.chainHasSupp ?? 0),
    readInterchrom: Uint8Array.of(spec.interchrom ?? 0),
    insertSizeStats,
  }
}

const stats = { upper: 600, lower: 100 }
const chainOpts = { chainMode: true }

describe('readColorCategory', () => {
  test('strand scheme buckets by read strand', () => {
    expect(
      readColorCategory(0, makeData({ strand: 1 }), ColorScheme.strand),
    ).toBe('fwdStrand')
    expect(
      readColorCategory(0, makeData({ strand: -1 }), ColorScheme.strand),
    ).toBe('revStrand')
    expect(
      readColorCategory(0, makeData({ strand: 0 }), ColorScheme.strand),
    ).toBe('noStrand')
  })

  test('insertSize scheme buckets against thresholds', () => {
    expect(
      readColorCategory(
        0,
        makeData({ insertSize: 700 }, stats),
        ColorScheme.insertSize,
      ),
    ).toBe('longInsert')
    expect(
      readColorCategory(
        0,
        makeData({ insertSize: 50 }, stats),
        ColorScheme.insertSize,
      ),
    ).toBe('shortInsert')
    expect(
      readColorCategory(
        0,
        makeData({ insertSize: 300 }, stats),
        ColorScheme.insertSize,
      ),
    ).toBe('normalInsert')
    // TLEN 0 = unset (single-end / unpaired read). Even in a mixed dataset where
    // stats is defined, it must not read as "short insert" (would paint pink).
    expect(
      readColorCategory(
        0,
        makeData({ insertSize: 0 }, stats),
        ColorScheme.insertSize,
      ),
    ).toBe('normalInsert')
  })

  test('pairOrientation scheme buckets by orientation code', () => {
    const cat = (po: number) =>
      readColorCategory(
        0,
        makeData({ pairOrientation: po }),
        ColorScheme.pairOrientation,
      )
    expect(cat(1)).toBe('pairLR')
    expect(cat(2)).toBe('pairRL')
    expect(cat(3)).toBe('pairRR')
    expect(cat(4)).toBe('pairLL')
  })

  test('pairOrientation with no orientation is the non-split bucket', () => {
    // A read with no pair orientation (long single reads, po=0) that isn't a
    // split segment gets the neutral non-split bucket. Only SPLIT alignments
    // (chained supplementary) show strand coloring, covered by the chainHasSupp
    // tests below.
    expect(
      readColorCategory(
        0,
        makeData({ pairOrientation: 0, strand: 1 }),
        ColorScheme.pairOrientation,
      ),
    ).toBe('nonSplit')
    expect(
      readColorCategory(
        0,
        makeData({ pairOrientation: 0, strand: -1 }),
        ColorScheme.pairOrientation,
      ),
    ).toBe('nonSplit')
  })

  test('insertSizeAndOrientation: short insert wins, else orientation, else insert', () => {
    // Short insert overrides abnormal orientation (stays pink)
    expect(
      readColorCategory(
        0,
        makeData({ pairOrientation: 2, insertSize: 50 }, stats),
        ColorScheme.insertSizeAndOrientation,
      ),
    ).toBe('shortInsert')
    // Long insert keeps abnormal orientation
    expect(
      readColorCategory(
        0,
        makeData({ pairOrientation: 2, insertSize: 700 }, stats),
        ColorScheme.insertSizeAndOrientation,
      ),
    ).toBe('pairRL')
    // Normal insert + abnormal orientation paints by orientation
    expect(
      readColorCategory(
        0,
        makeData({ pairOrientation: 2, insertSize: 300 }, stats),
        ColorScheme.insertSizeAndOrientation,
      ),
    ).toBe('pairRL')
    // po=1 (LR) falls through to the insert-size band
    expect(
      readColorCategory(
        0,
        makeData({ pairOrientation: 1, insertSize: 700 }, stats),
        ColorScheme.insertSizeAndOrientation,
      ),
    ).toBe('longInsert')
  })

  test('paired supplementary chains keep their per-scheme color', () => {
    // chain mode, paired (flags=1) supplementary read: no flat override, so it
    // falls through to the active scheme and the discordant-pair signal survives
    expect(
      readColorCategory(
        0,
        makeData({ chainHasSupp: 1, flags: 1, pairOrientation: 3 }),
        ColorScheme.pairOrientation,
        chainOpts,
      ),
    ).toBe('pairRR')
    // never the flat 'supplementary' bucket, in chain mode or pileup
    expect(
      readColorCategory(
        0,
        makeData({ chainHasSupp: 1, flags: 1 }),
        ColorScheme.strand,
        chainOpts,
      ),
    ).not.toBe('supplementary')
  })

  test('paired split-inversion chains (chainHasSupp=3) paint the dedicated split-inversion color', () => {
    // orientation schemes: the whole chain reads as an inversion regardless of
    // the concordant pair orientation it inherited (po=1 LR here)
    expect(
      readColorCategory(
        0,
        makeData({ chainHasSupp: 3, flags: 1, pairOrientation: 1 }),
        ColorScheme.pairOrientation,
        chainOpts,
      ),
    ).toBe('splitInversion')
    expect(
      readColorCategory(
        0,
        makeData({ chainHasSupp: 3, flags: 1, pairOrientation: 1 }, stats),
        ColorScheme.insertSizeAndOrientation,
        chainOpts,
      ),
    ).toBe('splitInversion')
    // non-orientation schemes keep their own coloring (strand here)
    expect(
      readColorCategory(
        0,
        makeData({ chainHasSupp: 3, flags: 1, strand: -1 }),
        ColorScheme.strand,
        chainOpts,
      ),
    ).toBe('revStrand')
    // pileup (chain mode off): no chain classification
    expect(
      readColorCategory(
        0,
        makeData({ chainHasSupp: 3, flags: 1, pairOrientation: 1 }),
        ColorScheme.pairOrientation,
      ),
    ).toBe('pairLR')
  })

  test('paired split-deletion chains (chainHasSupp=4) get the deletion bucket', () => {
    expect(
      readColorCategory(
        0,
        makeData({ chainHasSupp: 4, flags: 1, pairOrientation: 1 }),
        ColorScheme.pairOrientation,
        chainOpts,
      ),
    ).toBe('splitDeletion')
    expect(
      readColorCategory(
        0,
        makeData({ chainHasSupp: 4, flags: 1, pairOrientation: 1 }, stats),
        ColorScheme.insertSizeAndOrientation,
        chainOpts,
      ),
    ).toBe('splitDeletion')
    // non-orientation scheme (strand) keeps its own coloring
    expect(
      readColorCategory(
        0,
        makeData({ chainHasSupp: 4, flags: 1, strand: -1 }),
        ColorScheme.strand,
        chainOpts,
      ),
    ).toBe('revStrand')
  })

  test('colorSupplementaryChains opt-in restores the flat orange override', () => {
    // with the opt-in on, a paired supplementary chain is the flat bucket again,
    // overriding the pair-orientation color
    expect(
      readColorCategory(
        0,
        makeData({ chainHasSupp: 1, flags: 1, pairOrientation: 3 }),
        ColorScheme.pairOrientation,
        { ...chainOpts, colorSupplementaryChains: true },
      ),
    ).toBe('supplementary')
    // opt-in has no effect outside chain mode
    expect(
      readColorCategory(
        0,
        makeData({ chainHasSupp: 1, flags: 1, pairOrientation: 3 }),
        ColorScheme.pairOrientation,
        { colorSupplementaryChains: true },
      ),
    ).toBe('pairRR')
  })

  // It reaches long reads too, and outranks the strand framing there — the two
  // tickboxes are ordered, not scoped to different data.
  test('the orange opt-in covers unpaired chains and beats the strand framing', () => {
    const longRead = makeData({ chainHasSupp: 2, flags: 0, strand: 1 })
    expect(readColorCategory(0, longRead, ColorScheme.normal, chainOpts)).toBe(
      'revStrand',
    )
    expect(
      readColorCategory(0, longRead, ColorScheme.normal, {
        ...chainOpts,
        colorSupplementaryChains: true,
      }),
    ).toBe('supplementary')
    // and it is the one override that a data-carrying scheme does not displace,
    // because the user asked for it by name
    expect(
      readColorCategory(0, longRead, ColorScheme.tag, {
        ...chainOpts,
        colorSupplementaryChains: true,
      }),
    ).toBe('supplementary')
  })

  test('long-read (unpaired) supplementary chains frame strand against primary', () => {
    // unpaired (flags=0) supplementary with a reverse primary (chainHasSupp=2):
    // a forward segment reads as reverse once flipped into the primary frame
    expect(
      readColorCategory(
        0,
        makeData({ chainHasSupp: 2, flags: 0, strand: 1 }),
        ColorScheme.strand,
        chainOpts,
      ),
    ).toBe('revStrand')
    // pileup (chain mode off): no chain framing, plain strand applies
    expect(
      readColorCategory(
        0,
        makeData({ chainHasSupp: 2, flags: 0, strand: 1 }),
        ColorScheme.strand,
      ),
    ).toBe('fwdStrand')
    // Turning the framing off falls through to the scheme, which under `strand`
    // is the segment's own strand. The assertion above omits the option and
    // relies on it defaulting ON, so the two together pin the default rather
    // than just one side of the flag.
    expect(
      readColorCategory(
        0,
        makeData({ chainHasSupp: 2, flags: 0, strand: 1 }),
        ColorScheme.strand,
        { ...chainOpts, flipStrandLongReadChains: false },
      ),
    ).toBe('fwdStrand')
  })

  // The framing repaints the whole read, so it may only refine a fill that is
  // already about the alignment's geometry. Over a scheme carrying a per-read
  // datum it would answer a different question than the one the user asked.
  test('the long-read framing yields to the data-carrying schemes', () => {
    const supp = makeData({ chainHasSupp: 2, flags: 0, strand: 1, tagColor: 7 })
    expect(readColorCategory(0, supp, ColorScheme.tag, chainOpts)).toBe('tag')
    expect(
      readColorCategory(0, supp, ColorScheme.mappingQuality, chainOpts),
    ).toBe('mapq')
    expect(
      readColorCategory(0, supp, ColorScheme.modifications, chainOpts),
    ).toBe('modFwd')
    // the geometry schemes still frame — including the chain-mode default
    expect(
      readColorCategory(
        0,
        supp,
        ColorScheme.insertSizeAndOrientation,
        chainOpts,
      ),
    ).toBe('revStrand')
    expect(readColorCategory(0, supp, ColorScheme.normal, chainOpts)).toBe(
      'revStrand',
    )
  })

  // Unticking it is the only escape hatch under a geometry scheme, and it used
  // to leave the reads strand-coloured anyway.
  test('unticking the framing restores the scheme, not the unframed strand', () => {
    const supp = makeData({ chainHasSupp: 2, flags: 0, strand: 1 })
    const off = { ...chainOpts, flipStrandLongReadChains: false }
    expect(readColorCategory(0, supp, ColorScheme.normal, chainOpts)).toBe(
      'revStrand',
    )
    expect(readColorCategory(0, supp, ColorScheme.normal, off)).toBe('plain')
    expect(readColorCategory(0, supp, ColorScheme.pairOrientation, off)).toBe(
      'nonSplit',
    )
  })

  test('unmapped mate and inter-chromosomal apply to orientation schemes', () => {
    expect(
      readColorCategory(
        0,
        makeData({ flags: 8 }, stats),
        ColorScheme.insertSize,
      ),
    ).toBe('unmappedMate')
    expect(
      readColorCategory(
        0,
        makeData({ interchrom: 1 }, stats),
        ColorScheme.insertSize,
      ),
    ).toBe('interchrom')
    // ...but not to the plain strand scheme
    expect(
      readColorCategory(0, makeData({ interchrom: 1 }), ColorScheme.strand),
    ).toBe('fwdStrand')
  })

  // The CPU-baked schemes (tag values, chromosome painting) resolve no color
  // for a read the tag is absent from, or a block with no mate. It paints the
  // palette fallback, so it gets its own bucket and the legend can key that
  // neutral instead of leaving it as the one painted color with no entry.
  test('a read with no baked color is its own bucket under the tag scheme', () => {
    expect(
      readColorCategory(0, makeData({ tagColor: 0xff00ff00 }), ColorScheme.tag),
    ).toBe('tag')
    expect(readColorCategory(0, makeData({}), ColorScheme.tag)).toBe(
      'noTagValue',
    )
  })

  // Before the main thread bakes readTagColors the array is empty, and every
  // read is on the fallback for a different reason — don't report them all as
  // unvalued, which would key a "No HP value" swatch over the whole pileup.
  test('an unbaked (empty) color array is not reported as missing values', () => {
    const data = { ...makeData({}), readTagColors: new Uint32Array(0) }
    expect(readColorCategory(0, data, ColorScheme.tag)).toBe('tag')
  })
})

describe('getReadColor maps each category to its palette color', () => {
  test('discrete schemes paint the bucket color', () => {
    expect(
      getReadColor(0, makeData({ strand: -1 }), ColorScheme.strand, palette),
    ).toBe(rgb255(palette.colorRevStrand))
    // paired supplementary chain: falls through to the scheme color, not a flat
    // supplementary override
    expect(
      getReadColor(
        0,
        makeData({ chainHasSupp: 1, flags: 1, strand: -1 }),
        ColorScheme.strand,
        palette,
        chainOpts,
      ),
    ).toBe(rgb255(palette.colorRevStrand))
    expect(
      getReadColor(
        0,
        makeData({ insertSize: 700 }, stats),
        ColorScheme.insertSize,
        palette,
      ),
    ).toBe(rgb255(palette.colorLongInsert))
  })

  test('mapping quality uses an hsl ramp keyed on mapq', () => {
    expect(
      getReadColor(
        0,
        makeData({ mapq: 42 }),
        ColorScheme.mappingQuality,
        palette,
      ),
    ).toBe('hsl(42,50%,50%)')
  })

  // 255 is "mapping quality unavailable", not a score of 255. On the ramp it
  // came out an ordinary blue-violet — indistinguishable from a genuine very
  // high score, and named by nothing in the legend.
  test('mapq 255 leaves the ramp for the neutral unavailable swatch', () => {
    const data = makeData({ mapq: 255 })
    expect(readColorCategory(0, data, ColorScheme.mappingQuality)).toBe(
      'mapqUnavailable',
    )
    expect(getReadColor(0, data, ColorScheme.mappingQuality, palette)).toBe(
      rgb255(palette.colorNostrand),
    )
  })
})

// The `firstOfPairStrand` COLOR scheme and the `firstOfPairStrand` GROUPING
// dimension have to answer the same question about the same read: a read painted
// reverse belongs in the reverse section. They used to spell the fragment-strand
// rule twice under a comment promising they matched — this one read `strand`,
// the group key read SAM_FLAG_REVERSE — which agrees on every BAM and disagrees
// on a flagless synteny block. Both now call the shared `firstOfPairStrand`, and
// this pins that end to end rather than trusting the comment.
describe('firstOfPairStrand: color and grouping agree', () => {
  function feat(strand: number, flags: number) {
    return new SimpleFeature({
      uniqueId: 'r',
      refName: 'ctgA',
      start: 0,
      end: 100,
      strand,
      flags,
    })
  }

  test.each([
    ['read1 forward', 1, 0x40],
    ['read1 reverse', -1, 0x40],
    // read2 maps opposite its fragment, so a reverse read2 is a forward fragment
    ['read2 reverse', -1, 0x10 | 0x80],
    ['read2 forward', 1, 0x80],
    // no SAM flags at all: a PAF/synteny block, where the flag read reported
    // every reverse block as a forward fragment
    ['synteny reverse block', -1, 0],
    ['synteny forward block', 1, 0],
  ])('%s', (_label, strand, flags) => {
    const category = readColorCategory(
      0,
      makeData({ strand, flags }),
      ColorScheme.firstOfPairStrand,
    )
    const groups = partitionFeatures([feat(strand, flags)], {
      type: 'firstOfPairStrand',
    })
    expect(groups[0]!.key).toBe(category === 'revStrand' ? '-' : '+')
  })
})
