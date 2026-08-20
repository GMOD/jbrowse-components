import { packSyntenyFeatureData } from '../LinearSyntenyDisplay/testUtils.ts'
import {
  followWindowMapping,
  followWindowsMapping,
} from './followWindowMapping.ts'

import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { FeatureBlock } from '../LinearSyntenyDisplay/testUtils.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

// A grape window mapping onto peach, so the defaults name the right pair.
function data(blocks: (FeatureBlock & { mateStart: number })[]) {
  return packSyntenyFeatureData(
    blocks.map(b => ({
      ...b,
      assembly: 'grape',
      mateRefName: b.mateRefName ?? 'Pp01',
      mateAssembly: b.mateAssembly ?? 'peach',
    })),
    { hasCigar: false },
  )
}

const win = (start: number, end: number, refName = 'chr1'): FollowWindow => ({
  refName,
  start,
  end,
})

const map = (d: SyntenyFeatureData, w: FollowWindow, mateAssembly?: string) =>
  followWindowMapping({ data: d, window: w, toMate: true, mateAssembly })

// Three collinear blocks with gaps between them — the shape of gene-anchor
// synteny, and the shape that made the union answer a staircase.
const anchors = data([
  { start: 100_000, end: 200_000, mateStart: 1_100_000, mateEnd: 1_200_000 },
  { start: 400_000, end: 500_000, mateStart: 1_400_000, mateEnd: 1_500_000 },
  { start: 800_000, end: 900_000, mateStart: 1_800_000, mateEnd: 1_900_000 },
])

test('a window inside the blocks maps through them', () => {
  expect(map(anchors, win(150_000, 850_000))).toEqual({
    refName: 'Pp01',
    start: 1_150_000,
    end: 1_850_000,
  })
})

test('an edge in a gap interpolates between the blocks either side', () => {
  // 300,000 is halfway between block 1 ending at 200,000 and block 2 starting
  // at 400,000, so it maps halfway between 1,200,000 and 1,400,000
  expect(map(anchors, win(300_000, 850_000))?.start).toBe(1_300_000)
})

// The property the whole file exists for. The union of the mapped blocks moves
// only when a block enters or leaves the window, which on a real pan is one
// movement in thirty; mapping the edges moves on every step.
test('the mapping is continuous: every small pan moves the answer', () => {
  const seen = new Set<number>()
  for (let x = 250_000; x <= 350_000; x += 5_000) {
    seen.add(map(anchors, win(x, x + 400_000))!.start)
  }
  expect(seen.size).toBe(21)
})

test('it is continuous across a block boundary, not just inside gaps', () => {
  // approaching 200,000 (a block's right edge) from inside and from the gap
  // has to agree, or the followed row steps as the edge crosses
  const justInside = map(anchors, win(199_999, 600_000))!.start
  const atEdge = map(anchors, win(200_000, 600_000))!.start
  const justOutside = map(anchors, win(200_001, 600_000))!.start
  expect(atEdge).toBe(1_200_000)
  expect(atEdge - justInside).toBeCloseTo(1, 0)
  expect(justOutside - atEdge).toBeCloseTo(1, 0)
})

test('past the outermost block the answer stops rather than extrapolating', () => {
  // nothing is known out there, and inventing a scale measured elsewhere would
  // present a correspondence where there is none
  expect(map(anchors, win(0, 850_000))?.start).toBe(1_100_000)
  expect(map(anchors, win(150_000, 2_000_000))?.end).toBe(1_900_000)
})

test('a window with nothing under it has no answer', () => {
  expect(map(anchors, win(2_000_000, 3_000_000))).toBeUndefined()
})

test('the target contig most of the window aligns to wins the rest', () => {
  const d = data([
    { start: 0, end: 400_000, mateStart: 1_000_000, mateEnd: 1_400_000 },
    { start: 400_000, end: 900_000, mateStart: 1_400_000, mateEnd: 1_900_000 },
    {
      start: 950_000,
      end: 960_000,
      mateRefName: 'Pp08',
      mateStart: 20_000_000,
      mateEnd: 20_010_000,
    },
  ])
  expect(map(d, win(0, 1_000_000))).toMatchObject({ refName: 'Pp01' })
})

test('an all-vs-all lane the level is not about stays out of it', () => {
  const d = data([
    { start: 100_000, end: 200_000, mateStart: 1_000_000, mateEnd: 1_100_000 },
    {
      start: 800_000,
      end: 900_000,
      mateStart: 9_000_000,
      mateEnd: 9_100_000,
      mateAssembly: 'cacao',
    },
  ])
  expect(map(d, win(0, 1_000_000), 'peach')).toEqual({
    refName: 'Pp01',
    start: 1_000_000,
    end: 1_100_000,
  })
})

test('a reverse-strand block maps its left edge to the mate right', () => {
  const d = data([
    {
      start: 100_000,
      end: 200_000,
      mateStart: 1_000_000,
      mateEnd: 1_100_000,
      strand: -1,
    },
  ])
  // the window covers the block's left quarter, which is the mate's RIGHT
  // quarter
  expect(map(d, win(100_000, 125_000))).toEqual({
    refName: 'Pp01',
    start: 1_075_000,
    end: 1_100_000,
  })
})

// A whole-genome anchor shows every contig at once, and the blocks are the
// expensive part — so the several windows are answered in ONE scan of them.
describe('several windows at once', () => {
  const genome = data([
    { start: 100_000, end: 900_000, mateStart: 100_000, mateEnd: 900_000 },
    {
      refName: 'chr2',
      start: 50_000,
      end: 450_000,
      mateRefName: 'Pp02',
      mateStart: 50_000,
      mateEnd: 450_000,
    },
  ])

  test('each window is answered on its own contig', () => {
    expect(
      followWindowsMapping({
        data: genome,
        windows: [win(0, 1_000_000), win(0, 500_000, 'chr2')],
        toMate: true,
      }),
    ).toEqual([
      { refName: 'Pp01', start: 100_000, end: 900_000 },
      { refName: 'Pp02', start: 50_000, end: 450_000 },
    ])
  })

  test('a window with nothing under it answers undefined in place', () => {
    expect(
      followWindowsMapping({
        data: genome,
        windows: [win(0, 500_000, 'chr9'), win(0, 1_000_000)],
        toMate: true,
      }).map(s => s?.refName),
    ).toEqual([undefined, 'Pp01'])
  })

  // the one-pass form has to be the same arithmetic, or the rung it serves
  // would place rows differently from the rung below it
  test('an answer is the same as asking for that window alone', () => {
    const windows = [win(0, 1_000_000), win(0, 500_000, 'chr2')]
    expect(
      followWindowsMapping({ data: genome, windows, toMate: true }),
    ).toEqual(windows.map(w => map(genome, w)))
  })
})
