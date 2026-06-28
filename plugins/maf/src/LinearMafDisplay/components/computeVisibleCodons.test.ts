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

test('classifies each species codon vs the reference', () => {
  // ref:  ATG AAA TAA  → M K *
  // row1: ATG AAA TAA  → identical            → same, same, stop
  // row2: ATG GAA TAA  → M E *  (K→E)          → same, nonsyn, stop
  // row3: ATG AAG TAA  → M K *  (AAA→AAG, K=K) → same, syn,   stop
  const markers = computeVisibleCodons({
    view,
    rpcDataMap: new Map([
      [0, regionData('ATGAAATAA', ['ATGAAATAA', 'ATGGAATAA', 'ATGAAGTAA'])],
    ]),
    framesDataMap: new Map([[0, frames]]),
    defaultSrc: 'ref',
    rowHeight: 15,
    rowProportion: 0.8,
  })
  // 3 rows × 3 codons, emitted codon-major (each codon, then its rows)
  expect(markers.map(m => m.aa)).toEqual([
    'M', 'M', 'M', 'K', 'E', 'K', '*', '*', '*',
  ])
  expect(markers.map(m => m.change)).toEqual([
    'same', 'same', 'same', // codon 1 (M) — identical in all
    'same', 'nonsyn', 'syn', // codon 2 — ref K, row2 E, row3 silent
    'stop', 'stop', 'stop', // codon 3 (stop)
  ])
  // cell spans the 3 bases: scale=10, p0=100 → xLeft=0, width=30; center x=15
  expect(markers[0]).toMatchObject({ xLeft: 0, width: 30, x: 15 })
})

test('codons with a gap in a row are skipped for that row only', () => {
  // row2 has a gap in codon 1 → no cell there, but codons 2/3 still classify
  const markers = computeVisibleCodons({
    view,
    rpcDataMap: new Map([[0, regionData('ATGAAATAA', ['ATGAAATAA', 'A-GAAATAA'])]]),
    framesDataMap: new Map([[0, frames]]),
    defaultSrc: 'ref',
    rowHeight: 15,
    rowProportion: 0.8,
  })
  // ref: M K * ; row2: (gap) K * — row2's codon-1 cell is dropped
  expect(markers.map(m => m.aa)).toEqual(['M', 'K', 'K', '*', '*'])
})
