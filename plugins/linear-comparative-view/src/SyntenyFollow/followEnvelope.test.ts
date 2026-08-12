import { followEnvelope } from './followEnvelope.ts'

import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

interface Block {
  refName?: string
  start: number
  end: number
  mateRefName?: string
  mateStart: number
  mateEnd: number
  strand?: number
  mateAssembly?: string
}

function data(blocks: Block[]): SyntenyFeatureData {
  return {
    strands: Int8Array.from(blocks.map(b => b.strand ?? 1)),
    starts: Uint32Array.from(blocks.map(b => b.start)),
    ends: Uint32Array.from(blocks.map(b => b.end)),
    attributes: {},
    attributeRanges: {},
    featureIds: blocks.map((_, i) => `f${i}`),
    names: blocks.map((_, i) => `f${i}`),
    refNames: blocks.map(b => b.refName ?? 'chr1'),
    assemblyNames: blocks.map(() => 'grape'),
    mateStarts: Uint32Array.from(blocks.map(b => b.mateStart)),
    mateEnds: Uint32Array.from(blocks.map(b => b.mateEnd)),
    mateRefNames: blocks.map(b => b.mateRefName ?? 'Pp01'),
    mateAssemblyNames: blocks.map(b => b.mateAssembly ?? 'peach'),
    hasCigar: false,
  }
}

const WINDOW: FollowWindow = {
  refName: 'chr1',
  assemblyName: 'grape',
  start: 0,
  end: 1_000_000,
}

// The defect this exists for: hundreds of short MCScan blocks under one wide
// window resolved to whichever ONE overlapped it most, so the followed row
// zoomed to that block's own width — measured at 2131x on grape/peach.
test('many short blocks under a wide window span the whole stretch', () => {
  const d = data([
    { start: 100_000, end: 110_000, mateStart: 5_100_000, mateEnd: 5_110_000 },
    { start: 400_000, end: 420_000, mateStart: 5_400_000, mateEnd: 5_420_000 },
    { start: 900_000, end: 905_000, mateStart: 5_900_000, mateEnd: 5_905_000 },
  ])
  expect(followEnvelope({ data: d, window: WINDOW, toMate: true })).toEqual({
    refName: 'Pp01',
    start: 5_100_000,
    end: 5_905_000,
  })
})

test('a window with nothing under it has no envelope', () => {
  const d = data([
    {
      start: 2_000_000,
      end: 2_100_000,
      mateStart: 9_000_000,
      mateEnd: 9_100_000,
    },
  ])
  expect(
    followEnvelope({ data: d, window: WINDOW, toMate: true }),
  ).toBeUndefined()
})

test('the target contig most of the window aligns to wins the rest', () => {
  // a genome-scale window overlaps blocks landing on several contigs, and a
  // union across all of them is not a place
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
  expect(followEnvelope({ data: d, window: WINDOW, toMate: true })).toEqual({
    refName: 'Pp01',
    start: 1_000_000,
    end: 1_900_000,
  })
})

test('a block hanging out of the window contributes only its overlap', () => {
  // otherwise one long block half in the window drags the envelope to its far
  // end, which is the same failure in the opposite direction
  const d = data([
    {
      start: 900_000,
      end: 10_900_000,
      mateStart: 2_000_000,
      mateEnd: 12_000_000,
    },
  ])
  expect(followEnvelope({ data: d, window: WINDOW, toMate: true })).toEqual({
    refName: 'Pp01',
    start: 2_000_000,
    // only the 100kb of it the window covers
    end: 2_100_000,
  })
})

test('a reverse-strand block maps its overlap to the far end', () => {
  const d = data([
    {
      start: 900_000,
      end: 1_900_000,
      mateStart: 2_000_000,
      mateEnd: 3_000_000,
      strand: -1,
    },
  ])
  expect(followEnvelope({ data: d, window: WINDOW, toMate: true })).toEqual({
    refName: 'Pp01',
    start: 2_900_000,
    end: 3_000_000,
  })
})

test('the mate axis is read when the upper row is the one moving', () => {
  const d = data([
    {
      refName: 'chr9',
      start: 700_000,
      end: 800_000,
      mateRefName: 'chr1',
      mateStart: 100_000,
      mateEnd: 200_000,
    },
  ])
  expect(followEnvelope({ data: d, window: WINDOW, toMate: false })).toEqual({
    refName: 'chr9',
    start: 700_000,
    end: 800_000,
  })
})

test('an all-vs-all lane the level is not about stays out of the union', () => {
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
  expect(
    followEnvelope({
      data: d,
      window: WINDOW,
      toMate: true,
      mateAssembly: 'peach',
    }),
  ).toEqual({ refName: 'Pp01', start: 1_000_000, end: 1_100_000 })
})
