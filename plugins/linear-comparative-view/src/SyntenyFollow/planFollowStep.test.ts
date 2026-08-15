import { packSyntenyFeatureData } from '../LinearSyntenyDisplay/testUtils.ts'
import { planFollowStep } from './planFollowStep.ts'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type { FeatureBlock } from '../LinearSyntenyDisplay/testUtils.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

// `featureData` is the only member of the display this reads.
function display(blocks: FeatureBlock[], hasCigar = true) {
  return {
    featureData: packSyntenyFeatureData(blocks, { hasCigar }),
  } as unknown as LinearSyntenyDisplayModel
}

const WINDOW: FollowWindow = {
  refName: 'chr1',
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
  // mates offset by 10kb, so the answer can only have come from the mapping
  const step = plan([
    display([
      { id: 'left', start: 900, end: 1400, mateStart: 10900, mateEnd: 11400 },
      { id: 'right', start: 1600, end: 2100, mateStart: 11600, mateEnd: 12100 },
    ]),
  ])
  expect(step?.windowInsideFeat).toBe(false)
  // each window edge mapped through the block it sits in, rather than either
  // block's own width, which is what the single-block resolvers clamp to
  expect(step?.envelope).toEqual({ refName: 'chr1', start: 11000, end: 12000 })
})

describe('hysteresis across the tracks on one level', () => {
  // the same locus covered by two tracks — an all-vs-all file overlaid on a
  // pairwise one, or two aligners on the same pair
  const trackA = display([{ id: 'a', start: 1000, end: 1990 }])
  const trackB = display([{ id: 'b', start: 1000, end: 2000 }])

  test('with no incumbent the widest wins', () => {
    expect(plan([trackA, trackB])?.feat.id).toBe('b')
  })

  test('a marginally wider block on the other track does not steal the follow', () => {
    // comparing the displays' answers on raw overlap threw the margin away, so
    // the row flapped between the two tracks as the anchor panned
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
