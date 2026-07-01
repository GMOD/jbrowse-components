import {
  computeVisibleCodons,
  enumerateCodons,
  findCodonAt,
  translateCodonBytes,
} from './computeVisibleCodons.ts'
import { emptyMafCoverage } from './coverageTestFixture.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafFrameRecord } from '../../types.ts'

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

  test('forward frame 1/2 skip the leading partial codon', () => {
    expect(
      enumerateCodons([frame({ frame: 1 })], 'ref').map(c => c.positions[0]),
    ).toEqual([102, 105])
    expect(
      enumerateCodons([frame({ frame: 2 })], 'ref').map(c => c.positions[0]),
    ).toEqual([101, 104])
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
    'M',
    'M',
    'M',
    'K',
    'E',
    'K',
    '*',
    '*',
    '*',
  ])
  expect(markers.map(m => m.change)).toEqual([
    'same',
    'same',
    'same', // codon 1 (M) — identical in all
    'same',
    'nonsyn',
    'syn', // codon 2 — ref K, row2 E, row3 silent
    'stop',
    'stop',
    'stop', // codon 3 (stop)
  ])
  // cell spans the 3 bases: scale=10, p0=100 → xLeft=0, width=30; center x=15
  expect(markers[0]).toMatchObject({ xLeft: 0, width: 30, x: 15 })
})

test('codons with a gap in a row are skipped for that row only', () => {
  // row2 has a gap in codon 1 → no cell there, but codons 2/3 still classify
  const markers = computeVisibleCodons({
    view,
    rpcDataMap: new Map([
      [0, regionData('ATGAAATAA', ['ATGAAATAA', 'A-GAAATAA'])],
    ]),
    framesDataMap: new Map([[0, frames]]),
    defaultSrc: 'ref',
    rowHeight: 15,
    rowProportion: 0.8,
  })
  // ref: M K * ; row2: (gap) K * — row2's codon-1 cell is dropped
  expect(markers.map(m => m.aa)).toEqual(['M', 'K', 'K', '*', '*'])
})

describe('findCodonAt', () => {
  // ref: ATG AAA TAA → M K * ; row1 identical ; row2 codon-2 K→E (nonsyn)
  const region = regionData('ATGAAATAA', ['ATGAAATAA', 'ATGGAATAA'])

  test('returns the species codon + reference codon + change at a bp', () => {
    // bp 103 is in codon 2 (positions 103-105); row2 has GAA (E) vs ref AAA (K)
    expect(
      findCodonAt({
        blocks: region.blocks,
        frames,
        defaultSrc: 'ref',
        bp: 103,
        rowIndex: 1,
      }),
    ).toEqual({
      codon: 'GAA',
      aa: 'E',
      refCodon: 'AAA',
      refAa: 'K',
      change: 'nonsyn',
    })
  })

  test('any bp within the codon resolves the same codon', () => {
    for (const bp of [103, 104, 105]) {
      expect(
        findCodonAt({
          blocks: region.blocks,
          frames,
          defaultSrc: 'ref',
          bp,
          rowIndex: 0,
        }),
      ).toMatchObject({ codon: 'AAA', aa: 'K', change: 'same' })
    }
  })

  test('returns undefined outside any codon or for a gapped row', () => {
    expect(
      findCodonAt({
        blocks: region.blocks,
        frames,
        defaultSrc: 'ref',
        bp: 200,
        rowIndex: 0,
      }),
    ).toBeUndefined()
    const gapped = regionData('ATGAAATAA', ['A-GAAATAA'])
    expect(
      findCodonAt({
        blocks: gapped.blocks,
        frames,
        defaultSrc: 'ref',
        bp: 100,
        rowIndex: 0,
      }),
    ).toBeUndefined()
  })
})

// A block spanning an intron: exon A bases at the start, exon B base far away, so
// a codon stitched across the boundary has its three reference positions in one
// block. ATG (→ M) is split as [103,104] (exon A trailing) + [200] (exon B).
function stitchFixture() {
  const ref = Array.from({ length: 105 }, () => 'C')
  ref[3] = 'A' // position 103
  ref[4] = 'T' // position 104
  ref[100] = 'G' // position 200
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

test('findCodonAt resolves a codon stitched across an exon boundary', () => {
  const { region, frames: stitch } = stitchFixture()
  // hovering either piece (the trailing exon-A bases, or the exon-B base)
  // resolves the same reconstructed codon
  for (const bp of [103, 104, 200]) {
    expect(
      findCodonAt({
        blocks: region.blocks,
        frames: stitch,
        defaultSrc: 'ref',
        bp,
        rowIndex: 0,
      }),
    ).toMatchObject({ codon: 'ATG', aa: 'M', refCodon: 'ATG', change: 'same' })
  }
})

test('a stitched codon paints one cell per exon piece, glyph on the wider', () => {
  const { region, frames: stitch } = stitchFixture()
  const markers = computeVisibleCodons({
    view,
    rpcDataMap: new Map([[0, region]]),
    framesDataMap: new Map([[0, stitch]]),
    defaultSrc: 'ref',
    rowHeight: 15,
    rowProportion: 0.8,
  })
  // codon 1 [100,101,102]=CCC→P (one cell), stitched ATG→M as two cells
  const m = markers.filter(x => x.aa === 'M')
  expect(m).toHaveLength(2)
  // the wider piece (the 2-base exon-A run) carries the glyph; the 1-base piece
  // does not, so the residue isn't drawn twice
  expect(m.map(x => x.drawGlyph)).toEqual([true, false])
  expect(m.map(x => x.width)).toEqual([20, 10]) // scale=10: 2 bases vs 1 base
})
