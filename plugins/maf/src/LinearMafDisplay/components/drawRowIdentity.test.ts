import {
  IdentityColumns,
  drawRowIdentity,
  identityColor,
  identityRgb,
} from './drawRowIdentity.ts'
import { makeCellPxRange } from './visibleRegionGeometry.ts'

import type { MafBlock } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// test only
// eslint-disable-next-line  @typescript-eslint/no-misused-spread
const bytes = (s: string) => new Uint8Array([...s].map(c => c.charCodeAt(0)))

// one pixel per bp, wide enough that nothing clamps
const identityMapper = (bp: number) => bp

// Build one block's columns and splat a single row through them — the two-call
// shape `drawRowIdentity` uses per block, collapsed for the single-row cases
// below.
function accumulateRowIdentity(
  matchSum: Float32Array,
  classCount: Float32Array,
  rowBase: number,
  refBytes: Uint8Array,
  alignmentBytes: Uint8Array,
  startBp: number,
  bpToX: (bp: number) => number,
  xLo: number,
  xHi: number,
) {
  const columns = new IdentityColumns()
  columns.build(refBytes, startBp, makeCellPxRange(bpToX, xLo, xHi))
  columns.accumulate(matchSum, classCount, rowBase, alignmentBytes)
}

test('matches vs mismatches against the reference', () => {
  const match = new Float32Array(4)
  const cls = new Float32Array(4)
  accumulateRowIdentity(
    match,
    cls,
    0,
    bytes('ACGT'),
    bytes('ACGA'),
    0,
    identityMapper,
    0,
    4,
  )
  expect(Array.from(cls)).toEqual([1, 1, 1, 1])
  expect(Array.from(match)).toEqual([1, 1, 1, 0])
})

test('sample gaps are excluded from the denominator', () => {
  const match = new Float32Array(4)
  const cls = new Float32Array(4)
  accumulateRowIdentity(
    match,
    cls,
    0,
    bytes('ACGT'),
    bytes('A-GT'),
    0,
    identityMapper,
    0,
    4,
  )
  expect(Array.from(cls)).toEqual([1, 0, 1, 1])
  expect(Array.from(match)).toEqual([1, 0, 1, 1])
})

test('reference insertion columns (ref dash) consume no ref position', () => {
  const match = new Float32Array(3)
  const cls = new Float32Array(3)
  // ref A-CG: the middle column is a sample insertion, skipped; ref positions
  // are A(0) C(1) G(2).
  accumulateRowIdentity(
    match,
    cls,
    0,
    bytes('A-CG'),
    bytes('ATCG'),
    0,
    identityMapper,
    0,
    3,
  )
  expect(Array.from(cls)).toEqual([1, 1, 1])
  expect(Array.from(match)).toEqual([1, 1, 1])
})

test('reference N columns are unclassifiable', () => {
  const match = new Float32Array(2)
  const cls = new Float32Array(2)
  accumulateRowIdentity(
    match,
    cls,
    0,
    bytes('NA'),
    bytes('CA'),
    0,
    identityMapper,
    0,
    2,
  )
  expect(Array.from(cls)).toEqual([0, 1])
  expect(Array.from(match)).toEqual([0, 1])
})

test('comparison is case-insensitive (soft-masking ignored)', () => {
  const match = new Float32Array(2)
  const cls = new Float32Array(2)
  accumulateRowIdentity(
    match,
    cls,
    0,
    bytes('AC'),
    bytes('ac'),
    0,
    identityMapper,
    0,
    2,
  )
  expect(Array.from(match)).toEqual([1, 1])
})

test('zoomed out: several bases average into one pixel', () => {
  const match = new Float32Array(1)
  const cls = new Float32Array(1)
  // 4 bp per pixel; matches at 1,0,1,1 → 3/4.
  accumulateRowIdentity(
    match,
    cls,
    0,
    bytes('ACGT'),
    bytes('ATGT'),
    0,
    bp => bp / 4,
    0,
    1,
  )
  expect(cls[0]).toBe(4)
  expect(match[0]).toBe(3)
})

// The bound is the owning block's scissor span — see the matching test in
// drawConservation.test.ts for why the canvas width is not the right bound.
test('bases outside the block scissor span do not bleed into neighbors', () => {
  const match = new Float32Array(6)
  const cls = new Float32Array(6)
  accumulateRowIdentity(
    match,
    cls,
    0,
    bytes('ACGTAC'),
    bytes('ACGTAC'),
    0,
    identityMapper,
    2,
    4,
  )
  expect(Array.from(cls)).toEqual([0, 0, 1, 1, 0, 0])
  expect(Array.from(match)).toEqual([0, 0, 1, 1, 0, 0])
})

// The draw pass hands one flat row-major buffer to every row, so a row must
// only ever touch its own [rowBase, rowBase + width) slice.
test('rowBase confines a row to its slice of the shared accumulators', () => {
  const match = new Float32Array(6)
  const cls = new Float32Array(6)
  accumulateRowIdentity(
    match,
    cls,
    3,
    bytes('ACG'),
    bytes('ATG'),
    0,
    identityMapper,
    0,
    3,
  )
  expect(Array.from(cls)).toEqual([0, 0, 0, 1, 1, 1])
  expect(Array.from(match)).toEqual([0, 0, 0, 1, 0, 1])
})

// The column buffers outlive one block (they're reused for the whole draw
// pass), so a shorter block must not read the previous block's tail.
test('rebuilding for a shorter block does not leak the previous block', () => {
  const columns = new IdentityColumns()
  const cellPx = makeCellPxRange(identityMapper, 0, 6)
  columns.build(bytes('ACGTAC'), 0, cellPx)
  columns.build(bytes('AC'), 0, cellPx)
  const match = new Float32Array(6)
  const cls = new Float32Array(6)
  columns.accumulate(match, cls, 0, bytes('AC'))
  expect(Array.from(cls)).toEqual([1, 1, 0, 0, 0, 0])
  expect(Array.from(match)).toEqual([1, 1, 0, 0, 0, 0])
})

// A row shorter than the reference has no data past its end, so those columns
// are absent rather than mismatched — matching where `renderBases` and
// `buildInstanceBuffer` stop. Read as mismatches, a truncated row drew as a
// solid 0%-identity (divergent red) band instead of dropping out.
test('a row shorter than the reference is absent past its end, not mismatched', () => {
  const match = new Float32Array(4)
  const cls = new Float32Array(4)
  accumulateRowIdentity(
    match,
    cls,
    0,
    bytes('ACGT'),
    bytes('AC'),
    0,
    identityMapper,
    0,
    4,
  )
  expect(Array.from(cls)).toEqual([1, 1, 0, 0])
  expect(Array.from(match)).toEqual([1, 1, 0, 0])
})

test('identityColor ramps from divergent red through grey to conserved blue', () => {
  expect(identityColor(0)).toEqual([199, 67, 56])
  expect(identityColor(0.5)).toEqual([140, 140, 140])
  expect(identityColor(1)).toEqual([47, 102, 176])
})

test('identityColor clamps out-of-range input', () => {
  expect(identityColor(-1)).toEqual([199, 67, 56])
  expect(identityColor(2)).toEqual([47, 102, 176])
})

// The fetched region is the *buffered* one — roughly twice the visible span —
// so `drawRowIdentity` skips MAF blocks outside the render block's painted bp
// range instead of walking their columns and letting the clamp discard them.
// The skip is a fast path, so the picture it produces has to be identical to
// the one the unskipped walk produced: a block the render block can't paint
// must contribute nothing either way. An over-tight bound would silently drop
// the edge blocks that DO touch the block's first/last pixel.
describe('off-block MAF blocks cannot change the picture', () => {
  const WIDTH = 100
  const REGION_INDEX = 0

  function block(startBp: number, refSeq: string, alnSeq: string): MafBlock {
    return {
      startBp,
      endBp: startBp + refSeq.length,
      refSeqBytes: bytes(refSeq),
      rows: [{ rowIndex: 0, alignmentBytes: bytes(alnSeq) }],
      empties: [],
    }
  }

  // Records what actually reached the canvas, so the assertion is over pixels
  // rather than over the internal accumulators.
  function paint(blocks: MafBlock[]) {
    const calls: string[] = []
    let currentFill = ''
    const ctx = {
      set fillStyle(v: string) {
        currentFill = v
      },
      get fillStyle() {
        return currentFill
      },
      fillRect(x: number, y: number, w: number, h: number) {
        calls.push(`${currentFill} ${x},${y} ${w}x${h}`)
      },
    } as unknown as Ctx2D
    drawRowIdentity(
      ctx,
      [
        {
          displayedRegionIndex: REGION_INDEX,
          start: 1000,
          end: 1100,
          screenStartPx: 0,
          screenEndPx: WIDTH,
          reversed: false,
        },
      ],
      new Map([[REGION_INDEX, { blocks, coverage: undefined as never }]]),
      {
        rowHeight: 10,
        rowProportion: 0.8,
        nRows: 1,
        canvasWidth: WIDTH,
        canvasHeight: 10,
        scrollTop: 0,
        mode: 'heatmap',
      },
    )
    return calls
  }

  const inView = block(1040, 'ACGTACGTAC', 'ACGTACGAAC')

  test('a block far outside the painted range contributes nothing', () => {
    expect(paint([inView, block(500_000, 'ACGT', 'TTTT')])).toEqual(
      paint([inView]),
    )
  })

  test('a block straddling the render block start is still painted', () => {
    // Begins before the painted range and runs into it — MAF blocks do not
    // align to view edges, so this is the ordinary case at every pan. A bound
    // testing the block's *start* rather than its end against `bpLo` would drop
    // it, blanking the leading pixels of every row.
    const straddling = block(995, 'ACGTACGTAC', 'TTTTTTTTTT')
    expect(paint([straddling, inView]).length).toBeGreaterThan(
      paint([inView]).length,
    )
  })

  // The heatmap emits one rect per RUN of pixels sharing a ramp bucket, not one
  // per pixel: the loop is `visible rows x canvas width`, and on a conservation
  // alignment most of that is one bucket wide. Both halves matter — that the
  // merge happens at all, and that it is lossless.
  describe('the heatmap fill is run-length encoded', () => {
    // Expand the emitted rects back to a pixel -> color map, so losslessness is
    // checked where it is claimed: on the pixels, not on the rect list.
    function pixels(blocks: MafBlock[]) {
      const map = new Map<number, string>()
      for (const call of paint(blocks)) {
        const [fill, pos, size] = call.split(' ') as [string, string, string]
        const x = Number(pos.split(',')[0])
        const w = Number(size.split('x')[0])
        for (let i = x; i < x + w; i++) {
          // a pixel painted twice would mean overlapping runs
          expect(map.has(i)).toBe(false)
          map.set(i, fill)
        }
      }
      return map
    }

    // One bp per pixel here, so each pixel's identity is 0 or 1 and the ramp
    // has exactly two values: a conserved stretch is one rect however long.
    const oneMismatch = block(1040, 'ACGTACGTAC', 'ACGTACGAAC')

    test('a conserved stretch is one rect, not one per pixel', () => {
      // 10 painted pixels, mismatched only at offset 7 → runs [40,47) [47,48)
      // [48,50)
      expect(paint([oneMismatch])).toHaveLength(3)
    })

    test('the painted pixels are the same ones, in the same colors', () => {
      const map = pixels([oneMismatch])
      expect(map.size).toBe(10)
      const conserved = map.get(40)!
      expect(conserved).toBe(identityRgb(1))
      for (const x of [41, 42, 43, 44, 45, 46, 48, 49]) {
        expect(map.get(x)).toBe(conserved)
      }
      expect(map.get(47)).toBe(identityRgb(0))
    })

    test('unclassifiable pixels stay unpainted, so no run spans them', () => {
      // A reference `N` column is not classifiable, so its pixel must be left
      // for the canvas beneath — a run that merged across it would paint over
      // a pixel the old loop skipped.
      const withN = block(1040, 'ACGTNCGTAC', 'ACGTNCGTAC')
      const map = pixels([withN])
      expect(map.has(1040 - 1000 + 4)).toBe(false)
      expect(map.size).toBe(9)
      // and the gap splits it into two runs rather than one
      expect(paint([withN])).toHaveLength(2)
    })
  })
})
