import {
  buildCollapsedPileupMap,
  collapsedLayoutMaxY,
} from './collapsedLayout.ts'
import { makeEmptyPileupData } from './testUtils.ts'

// n features at the given [start, end] pairs, one region.
function region(spans: [number, number][]) {
  const positions = new Uint32Array(spans.length * 2)
  for (const [i, [start, end]] of spans.entries()) {
    positions[i * 2] = start
    positions[i * 2 + 1] = end
  }
  return new Map([
    [
      0,
      {
        ...makeEmptyPileupData(),
        readKeys: spans.map((_, i) => `f${i}`),
        readPositions: positions,
        readYs: new Uint16Array(spans.length),
      },
    ],
  ])
}

function only(map: ReturnType<typeof buildCollapsedPileupMap>) {
  return map.get(0)!
}

test('every feature lands on row 0 and the group is one row tall', () => {
  const out = only(
    buildCollapsedPileupMap(
      region([
        [0, 100],
        [50, 150],
        [60, 70],
      ]),
    ),
  )
  expect([...out.readYs]).toEqual([0, 0, 0])
  expect(out.maxY).toBe(1)
})

test('a lane whose features never overlap needs no expand affordance', () => {
  const out = only(
    buildCollapsedPileupMap(
      region([
        [0, 100],
        [100, 200],
      ]),
    ),
  )
  expect(out.truncated).toBe(false)
  expect(out.overlapPositions.length).toBe(0)
})

test('overlaps are marked, all at row 0, and flag the lane for expansion', () => {
  const out = only(
    buildCollapsedPileupMap(
      region([
        [0, 150],
        [100, 250],
      ]),
    ),
  )
  expect(out.truncated).toBe(true)
  expect([...out.overlapPositions]).toEqual([100, 150])
  expect([...out.overlapYs]).toEqual([0])
})

// The repeat-family case this exists for: one anchor interval aligning to many
// mate loci used to claim one row each. It now claims one row, and the depth
// shows as N-1 stacked tints over the same span.
test('a repeat stack collapses to one row with depth-proportional tinting', () => {
  const out = only(
    buildCollapsedPileupMap(region(Array.from({ length: 5 }, () => [10, 20]))),
  )
  expect(out.maxY).toBe(1)
  expect(out.overlapPositions.length / 2).toBe(4)
  expect([...out.overlapPositions]).toEqual([10, 20, 10, 20, 10, 20, 10, 20])
})

test('an empty region passes through untouched', () => {
  const empty = makeEmptyPileupData()
  const map = new Map([[0, empty]])
  expect(buildCollapsedPileupMap(map).get(0)).toBe(empty)
  expect(collapsedLayoutMaxY(map)).toBe(0)
})

test('collapsedLayoutMaxY matches the built map', () => {
  const map = region([
    [0, 100],
    [50, 150],
  ])
  expect(collapsedLayoutMaxY(map)).toBe(only(buildCollapsedPileupMap(map)).maxY)
})
