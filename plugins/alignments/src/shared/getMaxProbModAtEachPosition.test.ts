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
