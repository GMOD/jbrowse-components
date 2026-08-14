import { CIGAR_D, CIGAR_M } from '@jbrowse/cigar-utils'

import { forEachMaxProbMod } from './getMaxProbModAtEachPosition.ts'

import type { ModWithPositions } from '@jbrowse/modifications-utils'

const op = (len: number, code: number) => (len << 4) | code

function mod(
  type: string,
  base: string,
  positions: number[],
  probStart = 0,
  probStride = 1,
): ModWithPositions {
  return {
    type,
    base,
    strand: '+',
    unknownSkip: false,
    positions,
    probStart,
    probStride,
  }
}

function collect(
  mods: ModWithPositions[],
  ml: ArrayLike<number> | undefined,
  ops: number[],
  strand: -1 | 0 | 1 = 1,
) {
  const out: { ref: number; type: string; base: string; prob: number }[] = []
  forEachMaxProbMod(mods, ml, ops, strand, (ref, m, prob) => {
    out.push({ ref, type: m.type, base: m.base, prob })
  })
  return out
}

// The whole read is aligned, so read offset === reference offset.
const M100 = [op(100, CIGAR_M)]

test('emits one call per position, in ascending reference order', () => {
  expect(
    collect(
      [
        mod(
          'm',
          'C',
          [10, 3, 7].sort((a, b) => a - b),
        ),
      ],
      new Uint8Array([200, 100, 50]),
      M100,
    ),
  ).toEqual([
    { ref: 3, type: 'm', base: 'C', prob: (200 + 0.5) / 256 },
    { ref: 7, type: 'm', base: 'C', prob: (100 + 0.5) / 256 },
    { ref: 10, type: 'm', base: 'C', prob: (50 + 0.5) / 256 },
  ])
})

// A combined code like `C+mh` reports both 5mC and 5hmC at every cytosine, and
// only the more likely one is painted. This is the case the running-best array
// exists for.
describe('two modification types competing at one position', () => {
  const mods = [mod('m', 'C', [5], 0, 2), mod('h', 'C', [5], 1, 2)]

  test('the higher probability wins whichever order it arrives in', () => {
    expect(collect(mods, new Uint8Array([10, 240]), M100)).toEqual([
      { ref: 5, type: 'h', base: 'C', prob: (240 + 0.5) / 256 },
    ])
    expect(collect(mods, new Uint8Array([240, 10]), M100)).toEqual([
      { ref: 5, type: 'm', base: 'C', prob: (240 + 0.5) / 256 },
    ])
  })

  // The packed value is `(index + 1) << 8 | byte`, so a byte of 0 must still
  // read as "called" rather than as an empty slot — which is what the +1 is for.
  test('a zero probability is still a call, and the first type keeps it', () => {
    expect(collect(mods, new Uint8Array([0, 0]), M100)).toEqual([
      { ref: 5, type: 'm', base: 'C', prob: 0.5 / 256 },
    ])
  })
})

// What `getModPositions` actually returns for `C+mh`: one positions array, two
// entries pointing at it. That identity is what puts this function on its grouped
// branch — one CIGAR walk, winner picked across the group — so the cases above
// are repeated here against a shared array to pin the two branches to the same
// answers, and the cases only this branch can get wrong follow them.
//
// The describe above is not redundant with this one: its two `[5]` literals are
// equal and NOT identical, which is what holds the ungrouped branch in place.
describe('a combined code sharing one positions array by identity', () => {
  const shared = [5]
  const mods = [mod('m', 'C', shared, 0, 2), mod('h', 'C', shared, 1, 2)]

  test('the higher probability wins whichever order it arrives in', () => {
    expect(collect(mods, new Uint8Array([10, 240]), M100)).toEqual([
      { ref: 5, type: 'h', base: 'C', prob: (240 + 0.5) / 256 },
    ])
    expect(collect(mods, new Uint8Array([240, 10]), M100)).toEqual([
      { ref: 5, type: 'm', base: 'C', prob: (240 + 0.5) / 256 },
    ])
  })

  test('a zero probability is still a call, and the first type keeps it', () => {
    expect(collect(mods, new Uint8Array([0, 0]), M100)).toEqual([
      { ref: 5, type: 'm', base: 'C', prob: 0.5 / 256 },
    ])
  })

  test('a tie keeps the first type, as the per-entry walks did', () => {
    expect(collect(mods, new Uint8Array([128, 128]), M100)).toEqual([
      { ref: 5, type: 'm', base: 'C', prob: (128 + 0.5) / 256 },
    ])
  })

  // Several positions, with the winner alternating between the types, so a
  // grouped walk that hoisted the winner out of the per-position loop would fail
  // here rather than only on a fixture.
  test('the winner is chosen per position, not per group', () => {
    const positions = [2, 6, 9]
    const pair = [
      mod('m', 'C', positions, 0, 2),
      mod('h', 'C', positions, 1, 2),
    ]
    expect(
      collect(pair, new Uint8Array([200, 10, 10, 240, 100, 100]), M100),
    ).toEqual([
      { ref: 2, type: 'm', base: 'C', prob: (200 + 0.5) / 256 },
      { ref: 6, type: 'h', base: 'C', prob: (240 + 0.5) / 256 },
      { ref: 9, type: 'm', base: 'C', prob: (100 + 0.5) / 256 },
    ])
  })

  // A group whose types lose to an earlier, separately-walked group has to leave
  // that group's winner in place — the grouped branch writes a different packed
  // index, so this is the case that catches it writing unconditionally.
  test('an earlier group keeps a position the later group scores lower on', () => {
    const combined = [8]
    const mods2 = [
      mod('a', 'A', [8], 0, 1),
      mod('m', 'C', combined, 1, 2),
      mod('h', 'C', combined, 2, 2),
    ]
    expect(collect(mods2, new Uint8Array([250, 10, 20]), M100)).toEqual([
      { ref: 8, type: 'a', base: 'A', prob: (250 + 0.5) / 256 },
    ])
    expect(collect(mods2, new Uint8Array([30, 10, 240]), M100)).toEqual([
      { ref: 8, type: 'h', base: 'C', prob: (240 + 0.5) / 256 },
    ])
  })

  test('reverse strand reads its probabilities from the other end', () => {
    const positions = [4, 20]
    const pair = [
      mod('m', 'C', positions, 0, 2),
      mod('h', 'C', positions, 1, 2),
    ]
    // MM order is [20, 4], so the ML pairs are (m,h) for 20 then (m,h) for 4.
    expect(collect(pair, new Uint8Array([30, 250, 200, 10]), M100, -1)).toEqual(
      [
        { ref: 4, type: 'm', base: 'C', prob: (200 + 0.5) / 256 },
        { ref: 20, type: 'h', base: 'C', prob: (250 + 0.5) / 256 },
      ],
    )
  })

  test('with no ML tag every call reads probability zero and the first type wins', () => {
    expect(collect(mods, undefined, M100)).toEqual([
      { ref: 5, type: 'm', base: 'C', prob: 0.5 / 256 },
    ])
  })
})

test('with no ML tag every call reads probability zero and the first type wins', () => {
  const mods = [mod('m', 'C', [5]), mod('h', 'C', [5])]
  expect(collect(mods, undefined, M100)).toEqual([
    { ref: 5, type: 'm', base: 'C', prob: 0.5 / 256 },
  ])
})

// The scratch array is sized from the reference span, so a deletion — which
// consumes reference without consuming read — has to be counted or the last
// positions of the read fall off the end of it.
test('a deletion shifts reference positions past the read offsets', () => {
  const ops = [op(10, CIGAR_M), op(50, CIGAR_D), op(10, CIGAR_M)]
  expect(
    collect([mod('m', 'C', [2, 15])], new Uint8Array([200, 100]), ops),
  ).toEqual([
    { ref: 2, type: 'm', base: 'C', prob: (200 + 0.5) / 256 },
    { ref: 65, type: 'm', base: 'C', prob: (100 + 0.5) / 256 },
  ])
})

// A reverse-strand read stores its positions in descending MM order, so the
// ML index has to be recovered from the far end.
test('reverse strand reads its probabilities from the other end', () => {
  expect(
    collect([mod('m', 'C', [4, 20])], new Uint8Array([30, 250]), M100, -1),
  ).toEqual([
    { ref: 4, type: 'm', base: 'C', prob: (250 + 0.5) / 256 },
    { ref: 20, type: 'm', base: 'C', prob: (30 + 0.5) / 256 },
  ])
})

test('no modifications emits nothing', () => {
  expect(collect([], new Uint8Array([1]), M100)).toEqual([])
  expect(collect([mod('m', 'C', [])], new Uint8Array([]), M100)).toEqual([])
})
