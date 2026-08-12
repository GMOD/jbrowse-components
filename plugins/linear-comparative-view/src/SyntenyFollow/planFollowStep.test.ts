import { planFollowStep } from './planFollowStep.ts'

import type {
  LinearSyntenyDisplayModel,
  SyntenyFeatureData,
} from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

interface Block {
  id: string
  start: number
  end: number
  mateStart?: number
  mateEnd?: number
}

// Packs blocks the way the RPC hands them over, and wraps each set in the one
// member of the display this reads: a level's displays are asked for their
// `featureData` and nothing else.
function display(blocks: Block[], hasCigar = true) {
  const data: SyntenyFeatureData = {
    strands: Int8Array.from(blocks.map(() => 1)),
    starts: Uint32Array.from(blocks.map(b => b.start)),
    ends: Uint32Array.from(blocks.map(b => b.end)),
    attributes: {},
    attributeRanges: {},
    featureIds: blocks.map(b => b.id),
    names: blocks.map(b => b.id),
    refNames: blocks.map(() => 'chr1'),
    assemblyNames: blocks.map(() => 'hg002mat'),
    mateStarts: Uint32Array.from(blocks.map(b => b.mateStart ?? b.start)),
    mateEnds: Uint32Array.from(blocks.map(b => b.mateEnd ?? b.end)),
    mateRefNames: blocks.map(() => 'chr1'),
    mateAssemblyNames: blocks.map(() => 'hg002pat'),
    hasCigar,
  }
  return { featureData: data } as unknown as LinearSyntenyDisplayModel
}

const WINDOW: FollowWindow = {
  refName: 'chr1',
  assemblyName: 'hg002mat',
  start: 1000,
  end: 2000,
}

const plan = (displays: LinearSyntenyDisplayModel[], incumbentId?: string) =>
  planFollowStep({ displays, window: WINDOW, toMate: true, incumbentId })

test('a level with no loaded alignments has no step', () => {
  expect(
    plan([{ featureData: undefined } as unknown as LinearSyntenyDisplayModel]),
  ).toBeUndefined()
})

test('a window over unaligned sequence has no step', () => {
  expect(plan([display([{ id: 'a', start: 0, end: 500 }])])).toBeUndefined()
})

test('the widest alignment across every track on the level wins', () => {
  // a sparse track must not outvote the one that actually covers the locus
  const step = plan([
    display([{ id: 'sparse', start: 1900, end: 2100 }]),
    display([{ id: 'dense', start: 900, end: 2100 }]),
  ])
  expect(step?.feat.id).toBe('dense')
})

test('a window inside the alignment takes the exact walk and computes no envelope', () => {
  const step = plan([display([{ id: 'wide', start: 0, end: 5000 }])])
  expect(step?.windowInsideFeat).toBe(true)
  expect(step?.envelope).toBeUndefined()
})

test('a window wider than the alignment falls to the envelope', () => {
  // two blocks with a gap between them, mates offset by 10kb so the answer can
  // only have come from the mapping
  const step = plan([
    display([
      { id: 'left', start: 900, end: 1400, mateStart: 10900, mateEnd: 11400 },
      { id: 'right', start: 1600, end: 2100, mateStart: 11600, mateEnd: 12100 },
    ]),
  ])
  expect(step?.windowInsideFeat).toBe(false)
  // each WINDOW EDGE mapped through the block it sits in — 1000 through `left`
  // and 2000 through `right` — rather than either block's own width, which is
  // what the single-block resolvers would have clamped it to
  expect(step?.envelope).toEqual({ refName: 'chr1', start: 11000, end: 12000 })
})

describe('hysteresis across the tracks on one level', () => {
  // the same locus covered by two tracks — an all-vs-all file overlaid on a
  // pairwise one, or two aligners' output on the same pair
  const trackA = display([{ id: 'a', start: 1000, end: 1990 }])
  const trackB = display([{ id: 'b', start: 1000, end: 2000 }])

  test('with no incumbent the widest wins', () => {
    expect(plan([trackA, trackB])?.feat.id).toBe('b')
  })

  test('a marginally wider block on the other track does not steal the follow', () => {
    // the bug this covers: each display refuses to abandon its own block for a
    // 10bp improvement, and comparing their answers on raw overlap threw that
    // away, so the row flapped between the two tracks as the anchor panned
    expect(plan([trackA, trackB], 'a')?.feat.id).toBe('a')
  })

  test('a decisively better block on the other track does', () => {
    const sliver = display([{ id: 'a', start: 1000, end: 1100 }])
    expect(plan([sliver, trackB], 'a')?.feat.id).toBe('b')
  })

  test('an incumbent the window has left is dropped', () => {
    const gone = display([{ id: 'a', start: 0, end: 500 }])
    expect(plan([gone, trackB], 'a')?.feat.id).toBe('b')
  })

  test('an incumbent no longer loaded is simply absent', () => {
    expect(plan([trackA, trackB], 'dropped-in-the-last-refetch')?.feat.id).toBe(
      'b',
    )
  })
})
