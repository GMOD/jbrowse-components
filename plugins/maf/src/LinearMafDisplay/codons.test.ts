import {
  codonConservation,
  computeVisibleCodonGlyphs,
  encodeCodonConservation,
  encodeCodonSpans,
  enumerateCodons,
  findCodonAt,
  locateRegionCodons,
  translateCodonBytes,
} from './codons.ts'
import { emptyMafCoverage } from './components/coverageTestFixture.ts'

import type { MafRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafFrameRecord } from '../types.ts'

const enc = new TextEncoder()
const b = (s: string) => enc.encode(s)

describe('translateCodonBytes', () => {
  const codon = (s: string, strand: number) =>
    translateCodonBytes(
      s.charCodeAt(0),
      s.charCodeAt(1),
      s.charCodeAt(2),
      strand,
    )

  test('forward strand', () => {
    expect(codon('ATG', 1)).toBe('M')
    expect(codon('AAA', 1)).toBe('K')
    expect(codon('TAA', 1)).toBe('*')
    expect(codon('atg', 1)).toBe('M') // case-insensitive
  })

  test('minus strand reverse-complements', () => {
    // CAT is the reverse complement of ATG → M
    expect(codon('CAT', -1)).toBe('M')
    // TTA revcomp = TAA → stop
    expect(codon('TTA', -1)).toBe('*')
  })

  test('gaps and N yield no residue', () => {
    expect(codon('A-G', 1)).toBeUndefined()
    expect(codon('A G', 1)).toBeUndefined()
    expect(codon('ANG', 1)).toBeUndefined()
  })
})

describe('enumerateCodons', () => {
  const frame = (over: Partial<MafFrameRecord>): MafFrameRecord => ({
    refName: 'chr',
    start: 100,
    end: 109,
    src: 'ref',
    frame: 0,
    strand: 1,
    name: 'g',
    ...over,
  })

  test('forward frame 0: codons every 3 bp from start', () => {
    expect(enumerateCodons([frame({})], 'ref').map(c => c.positions)).toEqual([
      [100, 101, 102],
      [103, 104, 105],
      [106, 107, 108],
    ])
  })

  // `leadingPartialBases`: frame is the codon position of the record's first
  // base, so frame 1 means one base of the previous codon is still to come and
  // two of this exon's are needed — `(3 - frame) % 3`, which off by one either
  // way shifts every codon in the exon and reads as the alignment being wrong.
  test('forward frame 1/2 skip the leading partial codon', () => {
    expect(
      enumerateCodons([frame({ frame: 1 })], 'ref').map(c => c.positions[0]),
    ).toEqual([102, 105])
    expect(
      enumerateCodons([frame({ frame: 2 })], 'ref').map(c => c.positions[0]),
    ).toEqual([101, 104])
  })

  // A junk `frame` from a malformed file must not produce a negative skip and
  // index off the front of the record; the modulo folds it back in range.
  test('folds an out-of-spec frame back into 0..2', () => {
    const at = (f: number) =>
      enumerateCodons([frame({ frame: f })], 'ref').map(c => c.positions[0])
    expect(at(3)).toEqual(at(0))
    expect(at(-1)).toEqual(at(2))
    expect(at(-3)).toEqual(at(0))
  })

  test('minus strand reads right-to-left from end', () => {
    expect(
      enumerateCodons([frame({ strand: -1, frame: 0 })], 'ref').map(
        c => c.positions,
      ),
    ).toEqual([
      [106, 107, 108],
      [103, 104, 105],
      [100, 101, 102],
    ])
  })

  test('only the requested src contributes', () => {
    expect(enumerateCodons([frame({ src: 'other' })], 'ref')).toHaveLength(0)
  })

  test('forward: trailing partial is stitched from the next exon', () => {
    // exon A [100,105) frame 0 → one full codon [100,101,102], then 2 leftover
    // bases (103,104) completed by the next exon's first base at nextFramePos=200
    const codons = enumerateCodons(
      [frame({ start: 100, end: 105, nextFramePos: 200 })],
      'ref',
    )
    expect(codons.map(c => c.positions)).toEqual([
      [100, 101, 102],
      [103, 104, 200],
    ])
  })

  test('minus: trailing partial is stitched from the next (lower) exon', () => {
    // exon A [100,105) strand − frame 0: full codon [102,103,104] (txn 104→102),
    // 2 leftover (101,100) completed by nextFramePos=90 (next exon, lower coords)
    const codons = enumerateCodons(
      [frame({ start: 100, end: 105, strand: -1, nextFramePos: 90 })],
      'ref',
    )
    expect(codons.map(c => c.positions)).toEqual([
      [102, 103, 104],
      [90, 100, 101],
    ])
  })

  test('no stitch when there is no next exon (nextFramePos -1)', () => {
    const codons = enumerateCodons(
      [frame({ start: 100, end: 105, nextFramePos: -1 })],
      'ref',
    )
    expect(codons.map(c => c.positions)).toEqual([[100, 101, 102]])
  })
})

function regionData(refSeq: string, rows: string[]): MafRegionData {
  return {
    blocks: [
      {
        startBp: 100,
        endBp: 100 + refSeq.replaceAll('-', '').length,
        refSeqBytes: b(refSeq),
        rows: rows.map((alignment, rowIndex) => ({
          rowIndex,
          alignmentBytes: b(alignment),
        })),
        empties: [],
      },
    ],
    coverage: emptyMafCoverage(100),
  }
}

const frames: MafFrameRecord[] = [
  {
    refName: 'chr',
    start: 100,
    end: 109,
    src: 'ref',
    frame: 0,
    strand: 1,
    name: 'g',
  },
]

// `ref` is the anchor species throughout
const locate = (region: MafRegionData, f: MafFrameRecord[] = frames) =>
  locateRegionCodons(region, f, 'ref', 0)

// each call as [aa, change], codon-major
const calls = (region: MafRegionData, f?: MafFrameRecord[]) =>
  locate(region, f).flatMap(c => c.calls.map(call => [call.aa, call.change]))

test('classifies each species codon vs the reference', () => {
  // ref:  ATG AAA TAA  → M K *
  // row1: identical ; row2: K→E ; row3: AAA→AAG (K=K)
  expect(
    calls(regionData('ATGAAATAA', ['ATGAAATAA', 'ATGGAATAA', 'ATGAAGTAA'])),
  ).toEqual([
    ['M', 'same'],
    ['M', 'same'],
    ['M', 'same'],
    ['K', 'same'],
    ['E', 'nonsyn'],
    ['K', 'syn'],
    ['*', 'same'],
    ['*', 'same'],
    ['*', 'same'],
  ])
})

test('a stop is a change only where the reference codes an amino acid', () => {
  // row1: ATG TAA TAG → K→* gained, TAA→TAG both stops
  // row2: ATG AAA CAA → the reference stop read through
  expect(calls(regionData('ATGAAATAA', ['ATGTAATAG', 'ATGAAACAA']))).toEqual([
    ['M', 'same'],
    ['M', 'same'],
    ['*', 'stop'],
    ['K', 'same'],
    ['*', 'syn'],
    ['Q', 'nonsyn'],
  ])
})

test('a gapped codon is dropped for that row only', () => {
  expect(
    calls(regionData('ATGAAATAA', ['ATGAAATAA', 'A-GAAATAA'])).map(c => c[0]),
  ).toEqual(['M', 'K', 'K', '*', '*'])
})

// Block A holds bp 100-101 and block B 102-108, so codon 1 [100,101,102]
// straddles the boundary and is assembled from both.
function twoBlockRegion(
  aRef: string,
  aRows: string[],
  bRef: string,
  bRows: [number, string][],
): MafRegionData {
  return {
    blocks: [
      {
        startBp: 100,
        endBp: 100 + aRef.replaceAll('-', '').length,
        refSeqBytes: b(aRef),
        rows: aRows.map((alignment, rowIndex) => ({
          rowIndex,
          alignmentBytes: b(alignment),
        })),
        empties: [],
      },
      {
        startBp: 102,
        endBp: 102 + bRef.replaceAll('-', '').length,
        refSeqBytes: b(bRef),
        rows: bRows.map(([rowIndex, alignment]) => ({
          rowIndex,
          alignmentBytes: b(alignment),
        })),
        empties: [],
      },
    ],
    coverage: emptyMafCoverage(100),
  }
}

test('a codon straddling a block boundary is stitched from both blocks', () => {
  // row1 is only in block B, so it has no complete codon 1
  const region = twoBlockRegion('AT', ['AT'], 'GAAATAA', [
    [0, 'GAAATAA'],
    [1, 'GAAATAA'],
  ])
  expect(calls(region).map(c => c[0])).toEqual(['M', 'K', 'K', '*', '*'])
  expect(locate(region)[0]!.runs).toEqual([[100, 103]])
})

describe('codonConservation', () => {
  // row0 is the reference; row1 K→E at codon 2; row2 synonymous there
  const codons = locate(
    regionData('ATGAAATAA', ['ATGAAATAA', 'ATGGAATAA', 'ATGAAGTAA']),
  )

  test('per-codon amino-acid identity across the non-reference species', () => {
    expect(codons.map(c => codonConservation(c, 0))).toEqual([1, 0.5, 1])
  })

  test('refRowIndex -1 counts every row, the reference included', () => {
    expect(codons.map(c => codonConservation(c, -1))).toEqual([1, 2 / 3, 1])
  })

  test('a codon with no non-reference species is NaN, and draws no bar', () => {
    const only = locate(regionData('ATGAAATAA', ['ATGAAATAA']))
    expect(only.every(c => Number.isNaN(codonConservation(c, 0)))).toBe(true)
    expect(encodeCodonConservation(only, 0, 0).count).toBe(0)
  })

  test('a straddling codon still scores', () => {
    const straddling = locate(
      twoBlockRegion('AT', ['AT', 'AT'], 'GAAATAA', [
        [0, 'GAAATAA'],
        [1, 'GAAATAA'],
      ]),
    )
    expect(straddling.map(c => codonConservation(c, 0))).toEqual([1, 1, 1])
  })

  test('the band draws a bar per codon run at its conservation', () => {
    const bars = encodeCodonConservation(codons, 0, 7)
    expect(Array.from(bars.x)).toEqual([100, 103, 106])
    expect(Array.from(bars.x2)).toEqual([103, 106, 109])
    expect(Array.from(bars.y)).toEqual([1, 0.5, 1])
    expect(Array.from(bars.color)).toEqual([7, 7, 7])
  })
})

test('no frames, no codons', () => {
  expect(locate(regionData('ATGAAATAA', ['ATGAAATAA']), [])).toEqual([])
})

test('the cells fill every changed codon run, and leave conserved ones clean', () => {
  const codons = locate(regionData('ATGAAATAA', ['ATGAAATAA', 'ATGGAATAA']))
  const spans = encodeCodonSpans(codons, {
    same: undefined,
    syn: 1,
    nonsyn: 2,
    stop: 3,
  })
  expect(spans.count).toBe(1)
  expect([spans.x[0], spans.x2[0], spans.row[0], spans.color[0]]).toEqual([
    103, 106, 1, 2,
  ])
})

describe('findCodonAt', () => {
  const codons = locate(regionData('ATGAAATAA', ['ATGAAATAA', 'ATGGAATAA']))

  test('returns the species codon + reference codon + change at a bp', () => {
    expect(findCodonAt(codons, 103, 1)).toEqual({
      codon: 'GAA',
      aa: 'E',
      refCodon: 'AAA',
      refAa: 'K',
      change: 'nonsyn',
    })
  })

  test('any bp within the codon resolves the same codon', () => {
    for (const bp of [103, 104, 105]) {
      expect(findCodonAt(codons, bp, 0)).toMatchObject({
        codon: 'AAA',
        change: 'same',
      })
    }
  })

  test('undefined outside any codon or for a gapped row', () => {
    expect(findCodonAt(codons, 200, 0)).toBeUndefined()
    expect(
      findCodonAt(locate(regionData('ATGAAATAA', ['A-GAAATAA'])), 100, 0),
    ).toBeUndefined()
  })

  test('a straddling codon resolves from either block', () => {
    const straddling = locate(
      twoBlockRegion('AT', ['AT'], 'GAAATAA', [[0, 'GAAATAA']]),
    )
    for (const bp of [100, 101, 102]) {
      expect(findCodonAt(straddling, bp, 0)).toMatchObject({
        codon: 'ATG',
        change: 'same',
      })
    }
  })
})

// ATG is split as [103,104] (exon A trailing) + [200] (exon B), in one block
function stitchFixture() {
  const ref = Array.from({ length: 105 }, () => 'C')
  ref[3] = 'A'
  ref[4] = 'T'
  ref[100] = 'G'
  const refSeq = ref.join('')
  return {
    region: regionData(refSeq, [refSeq]),
    frames: [
      {
        refName: 'chr',
        start: 100,
        end: 105,
        src: 'ref',
        frame: 0,
        strand: 1,
        name: 'g',
        nextFramePos: 200,
      },
    ] satisfies MafFrameRecord[],
  }
}

test('a codon stitched across an exon boundary is two runs, resolved from both', () => {
  const { region, frames: stitch } = stitchFixture()
  const codons = locate(region, stitch)
  const m = codons.find(c => c.refAa === 'M')!
  expect(m.runs).toEqual([
    [103, 105],
    [200, 201],
  ])
  for (const bp of [103, 104, 200]) {
    expect(findCodonAt(codons, bp, 0)).toMatchObject({ codon: 'ATG' })
  }
})

describe('the letters', () => {
  const view = {
    visibleRegions: [
      {
        displayedRegionIndex: 0,
        start: 100,
        end: 130,
        screenStartPx: 0,
        reversed: false,
      },
    ],
    bpPerPx: 0.1,
  }
  const geometry = {
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  }

  test('draw one per call, centred on its codon', () => {
    const codons = locate(regionData('ATGAAATAA', ['ATGAAATAA', 'ATGGAATAA']))
    const glyphs = computeVisibleCodonGlyphs(
      view,
      new Map([[0, codons]]),
      geometry,
    )
    expect(glyphs.map(g => g.aa)).toEqual(['M', 'M', 'K', 'E', '*', '*'])
    // 10px a base from bp 100, so codon 1's middle is 15px
    expect(glyphs[0]!.x).toBe(15)
  })

  test('a stitched codon draws its letter once, on the wider run', () => {
    const { region, frames: stitch } = stitchFixture()
    const glyphs = computeVisibleCodonGlyphs(
      { ...view, visibleRegions: [{ ...view.visibleRegions[0]!, end: 210 }] },
      new Map([[0, locate(region, stitch)]]),
      geometry,
    )
    const m = glyphs.filter(g => g.aa === 'M')
    expect(m).toHaveLength(1)
    expect(m[0]!.x).toBe(40)
  })

  test('skip the codons off the view', () => {
    const wide = regionData('ATG'.repeat(100), ['ATG'.repeat(100)])
    const glyphs = computeVisibleCodonGlyphs(
      view,
      new Map([
        [
          0,
          locate(wide, [
            {
              refName: 'chr',
              start: 100,
              end: 400,
              src: 'ref',
              frame: 0,
              strand: 1,
              name: 'g',
            },
          ]),
        ],
      ]),
      geometry,
    )
    expect(glyphs.length).toBeGreaterThanOrEqual(10)
    expect(glyphs.length).toBeLessThanOrEqual(12)
  })
})
