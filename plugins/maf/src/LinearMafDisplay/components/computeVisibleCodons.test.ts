import {
  computeVisibleCodons,
  enumerateCodons,
  translateCodonBytes,
} from './computeVisibleCodons.ts'
import { emptyMafCoverage } from './coverageTestFixture.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafFrameRecord } from '../../types.ts'

const enc = new TextEncoder()
const b = (s: string) => enc.encode(s)

describe('translateCodonBytes', () => {
  const codon = (s: string, strand: number) =>
    translateCodonBytes(s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), strand)

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
    expect(enumerateCodons([frame({})], 'ref')).toEqual([
      { p0: 100, strand: 1 },
      { p0: 103, strand: 1 },
      { p0: 106, strand: 1 },
    ])
  })

  test('forward frame 1/2 skip the leading partial codon', () => {
    expect(enumerateCodons([frame({ frame: 1 })], 'ref').map(c => c.p0)).toEqual(
      [102, 105],
    )
    expect(enumerateCodons([frame({ frame: 2 })], 'ref').map(c => c.p0)).toEqual(
      [101, 104],
    )
  })

  test('minus strand reads right-to-left from end', () => {
    expect(
      enumerateCodons([frame({ strand: -1, frame: 0 })], 'ref'),
    ).toEqual([
      { p0: 106, strand: -1 },
      { p0: 103, strand: -1 },
      { p0: 100, strand: -1 },
    ])
  })

  test('only the requested src contributes', () => {
    expect(
      enumerateCodons([frame({ src: 'other' })], 'ref'),
    ).toHaveLength(0)
  })
})

function regionData(refSeq: string, rows: string[]): MafRegionData {
  return {
    blocks: [
      {
        startBp: 100,
        endBp: 100 + refSeq.replace(/-/g, '').length,
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

// bpPerPx 0.1 → 3/0.1 = 30 px per codon ≥ CHAR_SIZE_WIDTH, so codons compute
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

test('computeVisibleCodons translates each row and flags nonsynonymous change', () => {
  // ref:  ATG AAA TAA  → M K *
  // row1: ATG AAA TAA  → identical
  // row2: ATG GAA TAA  → M E *  (codon 2 nonsynonymous: K→E)
  const markers = computeVisibleCodons({
    view,
    rpcDataMap: new Map([[0, regionData('ATGAAATAA', ['ATGAAATAA', 'ATGGAATAA'])]]),
    framesDataMap: new Map([[0, frames]]),
    defaultSrc: 'ref',
    rowHeight: 15,
    rowProportion: 0.8,
  })
  // 2 rows × 3 codons, emitted codon-major (each codon, then its rows)
  expect(markers.map(m => m.aa)).toEqual(['M', 'M', 'K', 'E', '*', '*'])
  // only row2 codon2 (E) differs from the reference residue
  expect(markers.filter(m => m.differsFromRef).map(m => m.aa)).toEqual(['E'])
  // centered on the middle base of each codon: scale=10, center=(p0+1.5-100)*10
  // codon at p0=100 → (1.5)*10 = 15
  expect(markers[0]!.x).toBe(15)
})

test('codons with a gap in a row are skipped for that row only', () => {
  // row2 has a gap in codon 1 → no residue there, but codons 2/3 still translate
  const markers = computeVisibleCodons({
    view,
    rpcDataMap: new Map([[0, regionData('ATGAAATAA', ['ATGAAATAA', 'A-GAAATAA'])]]),
    framesDataMap: new Map([[0, frames]]),
    defaultSrc: 'ref',
    rowHeight: 15,
    rowProportion: 0.8,
  })
  // ref: M K * ; row2: (gap) K * — row2's codon-1 residue is dropped
  expect(markers.map(m => m.aa)).toEqual(['M', 'K', 'K', '*', '*'])
})

test('nothing computed when zoomed out past codon legibility', () => {
  const markers = computeVisibleCodons({
    view: { ...view, bpPerPx: 5 },
    rpcDataMap: new Map([[0, regionData('ATGAAATAA', ['ATGAAATAA'])]]),
    framesDataMap: new Map([[0, frames]]),
    defaultSrc: 'ref',
    rowHeight: 15,
    rowProportion: 0.8,
  })
  expect(markers).toHaveLength(0)
})
