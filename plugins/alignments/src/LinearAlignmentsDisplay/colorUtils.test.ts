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

  test('supplementary is a chain-mode-only bucket', () => {
    const supp = makeData({ chainHasSupp: 1, flags: 1 })
    // pileup (linkedReads off): supplementary is never painted as such
    expect(readColorCategory(0, supp, ColorScheme.strand)).not.toBe(
      'supplementary',
    )
    // chain mode: paired supplementary read is its own bucket
    expect(readColorCategory(0, supp, ColorScheme.strand, chainOpts)).toBe(
      'supplementary',
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
})

describe('getReadColor maps each category to its palette color', () => {
  test('discrete schemes paint the bucket color', () => {
    expect(
      getReadColor(0, makeData({ strand: -1 }), ColorScheme.strand, palette),
    ).toBe(rgb255(palette.colorRevStrand))
    expect(
      getReadColor(
        0,
        makeData({ chainHasSupp: 1, flags: 1 }),
        ColorScheme.strand,
        palette,
        chainOpts,
      ),
    ).toBe(rgb255(palette.colorSupplementary))
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
