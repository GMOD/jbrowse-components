import {
  computeCodonConservation,
  computeVisibleCodons,
  enumerateCodons,
  findCodonAt,
  locateVisibleCodons,
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

// The resolution pass the cells and the conservation band share (the model
// memoizes it as `locatedCodons`); `ref` is the anchor species throughout.
function locate(
  rpcDataMap: Map<number, MafRegionData>,
  framesDataMap: Map<number, MafFrameRecord[]>,
) {
  return locateVisibleCodons({
    view,
    rpcDataMap,
    framesDataMap,
    defaultSrc: 'ref',
  })
}

const GEOM = {
  rowHeight: 15,
  rowProportion: 0.8,
  scrollTop: 0,
  viewportHeight: 1000,
}

test('classifies each species codon vs the reference', () => {
  // ref:  ATG AAA TAA  → M K *
  // row1: ATG AAA TAA  → identical            → same, same, stop
  // row2: ATG GAA TAA  → M E *  (K→E)          → same, nonsyn, stop
  // row3: ATG AAG TAA  → M K *  (AAA→AAG, K=K) → same, syn,   stop
  const markers = computeVisibleCodons(
    locate(
      new Map([
        [0, regionData('ATGAAATAA', ['ATGAAATAA', 'ATGGAATAA', 'ATGAAGTAA'])],
      ]),
      new Map([[0, frames]]),
    ),
    GEOM,
  )
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
  const markers = computeVisibleCodons(
    locate(
      new Map([[0, regionData('ATGAAATAA', ['ATGAAATAA', 'A-GAAATAA'])]]),
      new Map([[0, frames]]),
    ),
    GEOM,
  )
  // ref: M K * ; row2: (gap) K * — row2's codon-1 cell is dropped
  expect(markers.map(m => m.aa)).toEqual(['M', 'K', 'K', '*', '*'])
})

// Two adjacent blocks splitting the reference mid-codon: block A holds bp
// 100-101, block B holds bp 102-108. The first codon [100,101,102] straddles the
// A/B boundary — before cross-block stitching it was dropped entirely (blank
// column that per-base coverage doesn't show); now it's assembled from both.
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
  // ref ATG AAA TAA (M K *); block A = "AT" (bp 100-101), block B = "GAAATAA"
  // (bp 102-108). Codon 1 [100,101,102] crosses the boundary. row0 is in both
  // blocks (full ATGAAATAA); row1 is only in block B, so it has no complete
  // codon 1 and that cell is dropped for it — but codons 2/3 still classify.
  const markers = computeVisibleCodons(
    locate(
      new Map([
        [
          0,
          twoBlockRegion('AT', ['AT'], 'GAAATAA', [
            [0, 'GAAATAA'],
            [1, 'GAAATAA'],
          ]),
        ],
      ]),
      new Map([[0, frames]]),
    ),
    GEOM,
  )
  // codon 1 (M): only row0 (present in both blocks); codons 2/3: both rows
  expect(markers.map(m => m.aa)).toEqual(['M', 'K', 'K', '*', '*'])
  // the straddling codon still spans its 3 bases as one contiguous cell
  expect(markers[0]).toMatchObject({ xLeft: 0, width: 30 })
})

test('computeCodonConservation stitches a boundary-straddling codon', () => {
  // ref M K *; row0 = reference (excluded), row1 = ATGAAATAA (all match).
  // Codon 1 straddles A/B; row1 present in both → conservation 1 there too, not
  // NaN (which is what the old block-local drop produced).
  const bars = computeCodonConservation(
    locate(
      new Map([
        [
          0,
          twoBlockRegion('AT', ['AT', 'AT'], 'GAAATAA', [
            [0, 'GAAATAA'],
            [1, 'GAAATAA'],
          ]),
        ],
      ]),
      new Map([[0, frames]]),
    ),
    { refRowIndex: 0 },
  )
  expect(bars.map(x => x.fraction)).toEqual([1, 1, 1])
})

// The cells are the one thing both consumers need, and with codon view and codon
// conservation both on they used to be split out of the positions twice per
// codon per frame. Memoized on the located codon, so the two get the same array.
test('the pixel cells are resolved once and shared by both consumers', () => {
  const codons = locate(
    new Map([[0, regionData('ATGAAATAA', ['ATGAAATAA'])]]),
    new Map([[0, frames]]),
  )
  const first = codons[0]!.cells()
  expect(first).toBe(codons[0]!.cells())
  // and it is the same geometry either consumer would have computed
  expect(first.map(c => c.xLeft)).toEqual(
    computeCodonConservation(codons.slice(0, 1), { refRowIndex: -1 }).map(
      b => b.xLeft,
    ),
  )
})

test('findCodonAt resolves a codon straddling a block boundary', () => {
  const region = twoBlockRegion('AT', ['AT'], 'GAAATAA', [[0, 'GAAATAA']])
  const codons = locate(new Map([[0, region]]), new Map([[0, frames]]))
  // bp 102 (the exon-B piece of the straddling codon 1) resolves the whole ATG
  for (const bp of [100, 101, 102]) {
    expect(
      findCodonAt({ codons, displayedRegionIndex: 0, bp, rowIndex: 0 }),
    ).toMatchObject({ codon: 'ATG', aa: 'M', refCodon: 'ATG', change: 'same' })
  }
})

describe('computeCodonConservation', () => {
  // ref:  ATG AAA TAA → M K *
  // row0: ATG AAA TAA (the reference row, excluded by refRowIndex)
  // row1: ATG GAA TAA → M E * (K→E, amino acid changed at codon 2)
  // row2: ATG AAG TAA → M K * (AAA→AAG, synonymous — still K at codon 2)
  const rpc = new Map([
    [0, regionData('ATGAAATAA', ['ATGAAATAA', 'ATGGAATAA', 'ATGAAGTAA'])],
  ])

  test('per-codon amino-acid identity across the non-reference species', () => {
    const bars = computeCodonConservation(locate(rpc, new Map([[0, frames]])), {
      refRowIndex: 0,
    })
    // codon 1 (M): both species match → 1; codon 2 (K): row1 E no, row2 K yes
    // (synonymous counts as conserved) → 0.5; codon 3 (*): both match → 1
    expect(bars.map(x => x.fraction)).toEqual([1, 0.5, 1])
    // one contiguous cell per codon; scale=10, region start 100
    expect(bars.map(x => x.xLeft)).toEqual([0, 30, 60])
    expect(bars.map(x => x.width)).toEqual([30, 30, 30])
  })

  test('refRowIndex -1 counts every row (reference included)', () => {
    const bars = computeCodonConservation(locate(rpc, new Map([[0, frames]])), {
      refRowIndex: -1,
    })
    // codon 2 (K): ref K + row2 K match, row1 E doesn't → 2/3
    expect(bars.map(x => x.fraction)).toEqual([1, 2 / 3, 1])
  })

  test('a codon with no translatable non-reference species is NaN', () => {
    const bars = computeCodonConservation(
      // only the reference row present; excluding it leaves nothing classifiable
      locate(
        new Map([[0, regionData('ATGAAATAA', ['ATGAAATAA'])]]),
        new Map([[0, frames]]),
      ),
      { refRowIndex: 0 },
    )
    expect(bars.every(x => Number.isNaN(x.fraction))).toBe(true)
  })

  test('no frames → no bars', () => {
    expect(
      computeCodonConservation(locate(rpc, new Map()), { refRowIndex: 0 }),
    ).toEqual([])
  })
})

describe('findCodonAt', () => {
  // ref: ATG AAA TAA → M K * ; row1 identical ; row2 codon-2 K→E (nonsyn)
  const region = regionData('ATGAAATAA', ['ATGAAATAA', 'ATGGAATAA'])
  const codons = locate(new Map([[0, region]]), new Map([[0, frames]]))

  test('returns the species codon + reference codon + change at a bp', () => {
    // bp 103 is in codon 2 (positions 103-105); row2 has GAA (E) vs ref AAA (K)
    expect(
      findCodonAt({ codons, displayedRegionIndex: 0, bp: 103, rowIndex: 1 }),
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
        findCodonAt({ codons, displayedRegionIndex: 0, bp, rowIndex: 0 }),
      ).toMatchObject({ codon: 'AAA', aa: 'K', change: 'same' })
    }
  })

  test('returns undefined outside any codon or for a gapped row', () => {
    expect(
      findCodonAt({ codons, displayedRegionIndex: 0, bp: 200, rowIndex: 0 }),
    ).toBeUndefined()
    const gapped = locate(
      new Map([[0, regionData('ATGAAATAA', ['A-GAAATAA'])]]),
      new Map([[0, frames]]),
    )
    expect(
      findCodonAt({
        codons: gapped,
        displayedRegionIndex: 0,
        bp: 100,
        rowIndex: 0,
      }),
    ).toBeUndefined()
  })

  // Absolute bp is only unique within a displayed region, so a codon resolved in
  // region 0 must not answer a hover in region 1 (two chromosomes on screen can
  // cover the same coordinate).
  test('does not resolve a codon from a different displayed region', () => {
    expect(
      findCodonAt({ codons, displayedRegionIndex: 1, bp: 103, rowIndex: 1 }),
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
  const codons = locate(new Map([[0, region]]), new Map([[0, stitch]]))
  // hovering either piece (the trailing exon-A bases, or the exon-B base)
  // resolves the same reconstructed codon
  for (const bp of [103, 104, 200]) {
    expect(
      findCodonAt({ codons, displayedRegionIndex: 0, bp, rowIndex: 0 }),
    ).toMatchObject({ codon: 'ATG', aa: 'M', refCodon: 'ATG', change: 'same' })
  }
})

test('a stitched codon paints one cell per exon piece, glyph on the wider', () => {
  const { region, frames: stitch } = stitchFixture()
  const markers = computeVisibleCodons(
    locate(new Map([[0, region]]), new Map([[0, stitch]])),
    GEOM,
  )
  // codon 1 [100,101,102]=CCC→P (one cell), stitched ATG→M as two cells
  const m = markers.filter(x => x.aa === 'M')
  expect(m).toHaveLength(2)
  // the wider piece (the 2-base exon-A run) carries the glyph; the 1-base piece
  // does not, so the residue isn't drawn twice
  expect(m.map(x => x.drawGlyph)).toEqual([true, false])
  expect(m.map(x => x.width)).toEqual([20, 10]) // scale=10: 2 bases vs 1 base
})

// The frames and the alignment are both fetched for the *buffered* region,
// which is roughly twice the visible span, so about half of what
// `enumerateCodons` yields is off screen — and resolving one costs three binary
// searches plus a per-row byte gather. Every sibling marker walk culls against
// the visible region's `[bpLo, bpHi)`; the codon spine was the one left that
// resolved (and emitted) the lot.
describe('the codon spine culls to the visible region', () => {
  // 300bp of blocks against a view showing [100, 130) — the same `view` above,
  // whose slack at 0.1 bp/px is under 3bp.
  const wideRegion: MafRegionData = {
    blocks: [
      {
        startBp: 100,
        endBp: 400,
        refSeqBytes: b('ATG'.repeat(100)),
        rows: [{ rowIndex: 0, alignmentBytes: b('ATG'.repeat(100)) }],
        empties: [],
      },
    ],
    coverage: emptyMafCoverage(100),
  }
  // one CDS spanning every block: 100 codons, only ~10 of them on screen
  const wideFrames: MafFrameRecord[] = [
    {
      refName: 'chr',
      start: 100,
      end: 400,
      src: 'ref',
      frame: 0,
      strand: 1,
      name: 'g',
    },
  ]

  it('resolves only the codons the view can show', () => {
    const located = locate(
      new Map([[0, wideRegion]]),
      new Map([[0, wideFrames]]),
    )
    // [100, 130) is ten codons; the cull is padded by the shared slack, so
    // allow an edge codon either side rather than pinning the exact count
    expect(located.length).toBeGreaterThanOrEqual(10)
    expect(located.length).toBeLessThanOrEqual(12)
    for (const c of located) {
      expect(c.codon.positions[2]).toBeGreaterThanOrEqual(100)
      expect(c.codon.positions[0]).toBeLessThan(133)
    }
  })

  it('keeps a codon that only overlaps the view at one end', () => {
    // stitched across an exon boundary: one piece far to the left of the view,
    // the other inside it. Both pieces draw a cell, so the codon must survive.
    const straddling: MafFrameRecord[] = [
      {
        refName: 'chr',
        start: 110,
        end: 112,
        src: 'ref',
        frame: 0,
        strand: 1,
        name: 'g',
        nextFramePos: 200,
      },
    ]
    const located = locate(
      new Map([[0, wideRegion]]),
      new Map([[0, straddling]]),
    )
    expect(located.map(c => c.codon.positions)).toEqual([[110, 111, 200]])
  })
})
