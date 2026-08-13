import { pickFollowFeature } from './pickFollowFeature.ts'

import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

interface Block {
  id: string
  refName: string
  start: number
  end: number
  mateRefName?: string
  mateStart?: number
  mateEnd?: number
  mateAssembly?: string
}

// Packs blocks the way the RPC hands them over: parallel typed arrays, not
// objects. Mate coords default to the feature's own, which is enough for the
// tests that only exercise one axis.
function data(blocks: Block[]): SyntenyFeatureData {
  return {
    strands: Int8Array.from(blocks.map(() => 1)),
    starts: Uint32Array.from(blocks.map(b => b.start)),
    ends: Uint32Array.from(blocks.map(b => b.end)),
    attributes: {},
    attributeRanges: {},
    featureIds: blocks.map(b => b.id),
    names: blocks.map(b => b.id),
    refNames: blocks.map(b => b.refName),
    assemblyNames: blocks.map(() => 'hg002mat'),
    mateStarts: Uint32Array.from(blocks.map(b => b.mateStart ?? b.start)),
    mateEnds: Uint32Array.from(blocks.map(b => b.mateEnd ?? b.end)),
    mateRefNames: blocks.map(b => b.mateRefName ?? b.refName),
    mateAssemblyNames: blocks.map(b => b.mateAssembly ?? 'hg002pat'),
    hasCigar: true,
  }
}

const WINDOW: FollowWindow = {
  refName: 'chr1',
  start: 1000,
  end: 2000,
}

test('the alignment covering the most of the window wins', () => {
  const d = data([
    { id: 'sliver', refName: 'chr1', start: 1900, end: 2500 },
    { id: 'wide', refName: 'chr1', start: 500, end: 2200 },
  ])
  expect(pickFollowFeature({ data: d, window: WINDOW, toMate: true })).toEqual({
    index: 1,
    overlap: 1000,
  })
})

test('alignments on another contig are not candidates', () => {
  const d = data([{ id: 'elsewhere', refName: 'chr2', start: 1000, end: 2000 }])
  expect(
    pickFollowFeature({ data: d, window: WINDOW, toMate: true }),
  ).toBeUndefined()
})

test('a window over unaligned sequence has no answer', () => {
  // the moving panel holds position rather than being sent somewhere invented
  const d = data([{ id: 'left', refName: 'chr1', start: 0, end: 500 }])
  expect(
    pickFollowFeature({ data: d, window: WINDOW, toMate: true }),
  ).toBeUndefined()
})

test('a block merely abutting the window does not count as covering it', () => {
  const d = data([{ id: 'abut', refName: 'chr1', start: 0, end: 1000 }])
  expect(
    pickFollowFeature({ data: d, window: WINDOW, toMate: true }),
  ).toBeUndefined()
})

test('the mate axis is matched when the upper panel is the one moving', () => {
  // the query axis says chr9 here, so a direction mix-up would find nothing
  const d = data([
    {
      id: 'x',
      refName: 'chr9',
      start: 0,
      end: 100,
      mateRefName: 'chr1',
      mateStart: 1200,
      mateEnd: 1800,
    },
  ])
  expect(pickFollowFeature({ data: d, window: WINDOW, toMate: false })).toEqual(
    {
      index: 0,
      overlap: 600,
    },
  )
  expect(
    pickFollowFeature({ data: d, window: WINDOW, toMate: true }),
  ).toBeUndefined()
})

// Belt to the adapter's braces: the shipped all-vs-all adapter already drops the
// other pairs at the source (it honors the fetch's `targetAssemblyName`), so
// these cases describe what this function does when handed a mixed set anyway —
// which is what an adapter ignoring that hint would produce.
describe('the mate-assembly filter', () => {
  const mixed = data([
    // the widest alignment at this locus goes to a sample that is not on screen
    {
      id: 'other-sample',
      refName: 'chr1',
      start: 1000,
      end: 2000,
      mateAssembly: 'HG00733#1',
    },
    {
      id: 'this-row',
      refName: 'chr1',
      start: 1200,
      end: 1900,
      mateAssembly: 'hg002pat',
    },
  ])

  test('unfiltered, the widest alignment wins whoever it is to', () => {
    // the answer that would send the lower row to a contig of another genome
    expect(
      pickFollowFeature({ data: mixed, window: WINDOW, toMate: true }),
    ).toMatchObject({ index: 0 })
  })

  test('naming the level lower row assembly picks the alignment to it', () => {
    expect(
      pickFollowFeature({
        data: mixed,
        window: WINDOW,
        toMate: true,
        mateAssembly: 'hg002pat',
      }),
    ).toMatchObject({ index: 1 })
  })

  test('a lane with nothing at this locus has no answer rather than a wrong one', () => {
    expect(
      pickFollowFeature({
        data: mixed,
        window: WINDOW,
        toMate: true,
        mateAssembly: 'HG01234#2',
      }),
    ).toBeUndefined()
  })

  test('it reads the mate axis in both directions', () => {
    // the mate axis is the multi-assembly one whichever row is moving, so the
    // same array is checked when the upper row is the one being placed
    const d = data([
      {
        id: 'x',
        refName: 'chr9',
        start: 0,
        end: 100,
        mateRefName: 'chr1',
        mateStart: 1200,
        mateEnd: 1800,
        mateAssembly: 'HG00733#1',
      },
    ])
    expect(
      pickFollowFeature({
        data: d,
        window: WINDOW,
        toMate: false,
        mateAssembly: 'hg002pat',
      }),
    ).toBeUndefined()
  })
})

describe('hysteresis', () => {
  // two near-identical blocks over the same window: a segmental duplication, or
  // two rows of an all-vs-all file
  const paralogs = data([
    { id: 'a', refName: 'chr1', start: 1000, end: 1990 },
    { id: 'b', refName: 'chr1', start: 1000, end: 2000 },
  ])

  test('with no incumbent the widest wins', () => {
    expect(
      pickFollowFeature({ data: paralogs, window: WINDOW, toMate: true }),
    ).toMatchObject({ index: 1 })
  })

  test('a marginally better challenger does not steal the follow', () => {
    expect(
      pickFollowFeature({
        data: paralogs,
        window: WINDOW,
        toMate: true,
        incumbentId: 'a',
      }),
    ).toMatchObject({ index: 0 })
  })

  test('a decisively better challenger does', () => {
    const d = data([
      { id: 'a', refName: 'chr1', start: 1000, end: 1100 },
      { id: 'b', refName: 'chr1', start: 1000, end: 2000 },
    ])
    expect(
      pickFollowFeature({
        data: d,
        window: WINDOW,
        toMate: true,
        incumbentId: 'a',
      }),
    ).toMatchObject({ index: 1 })
  })

  test('an incumbent the window has left is dropped', () => {
    const d = data([
      { id: 'a', refName: 'chr1', start: 0, end: 500 },
      { id: 'b', refName: 'chr1', start: 1000, end: 2000 },
    ])
    expect(
      pickFollowFeature({
        data: d,
        window: WINDOW,
        toMate: true,
        incumbentId: 'a',
      }),
    ).toMatchObject({ index: 1 })
  })

  test('an incumbent no longer loaded is simply absent', () => {
    expect(
      pickFollowFeature({
        data: paralogs,
        window: WINDOW,
        toMate: true,
        incumbentId: 'gone-in-the-last-refetch',
      }),
    ).toMatchObject({ index: 1 })
  })
})
