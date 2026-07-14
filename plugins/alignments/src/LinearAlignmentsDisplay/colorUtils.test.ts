import { getReadColor, readColorCategory, rgb255 } from './colorUtils.ts'
import { ColorScheme } from './constants.ts'
import { makeTestPalette } from './testUtils.ts'

import type { RGBColor } from './shaders/colors.ts'

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
const chainOpts = { linkedReads: 'normal' as const }

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

  test('pairOrientation with no orientation falls back to read strand', () => {
    // Unpaired/single-end reads (po=0) still have a strand — never grey noStrand.
    expect(
      readColorCategory(
        0,
        makeData({ pairOrientation: 0, strand: 1 }),
        ColorScheme.pairOrientation,
      ),
    ).toBe('fwdStrand')
    expect(
      readColorCategory(
        0,
        makeData({ pairOrientation: 0, strand: -1 }),
        ColorScheme.pairOrientation,
      ),
    ).toBe('revStrand')
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
    // pileup (linkedReads off): no chain classification
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
    // pileup (linkedReads off): no chain framing, plain strand applies
    expect(
      readColorCategory(
        0,
        makeData({ chainHasSupp: 2, flags: 0, strand: 1 }),
        ColorScheme.strand,
      ),
    ).toBe('fwdStrand')
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

  test('insertSizeGradient lerps rather than painting the flat endpoint', () => {
    const color = getReadColor(
      0,
      makeData({ insertSize: 700 }, stats),
      ColorScheme.insertSizeGradient,
      palette,
    )
    // a partial lerp toward the long-insert endpoint, not the flat endpoint
    expect(color).not.toBe(rgb255(palette.colorLongInsert))
    expect(color).not.toBe(rgb255(palette.colorPairLR))
  })

  test('insertSizeGradient saturates at IS_GRADIENT_SPAN_FRAC of the band', () => {
    // band span = upper-lower = 500; ramp width = 500 * 0.5 = 250, so a read at
    // upper + 250 = 850 reaches the full long-insert endpoint (the old full-band
    // ramp would still be mid-lerp here).
    expect(
      getReadColor(
        0,
        makeData({ insertSize: 850 }, stats),
        ColorScheme.insertSizeGradient,
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
})
