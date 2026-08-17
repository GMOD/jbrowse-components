import { buildMismatchArrays } from './buildArrays.ts'

import type { MismatchData } from '../../shared/webglRpcTypes.ts'

// `mismatchPositions` arriving ascending is a CONTRACT, not an incidental: the
// coverage hit test and the tooltip both `lowerBound` the shipped array instead
// of building a side index, so read-order output would make them return a
// plausible wrong answer rather than fail. This is the test that stops that.
function mm(position: number, base: number, readIndex: number): MismatchData {
  return {
    position,
    base,
    strand: readIndex % 2 === 0 ? 1 : -1,
    readIndex,
    qual: 30 + (readIndex % 10),
  }
}

describe('buildMismatchArrays ordering', () => {
  it('emits positions ascending from read-order input', () => {
    // Read order: three reads each contributing mismatches at their own spots,
    // which is what the walk produces and what is NOT sorted.
    const arrays = buildMismatchArrays(
      [
        mm(300, 65, 0),
        mm(100, 67, 0),
        mm(500, 71, 1),
        mm(200, 84, 1),
        mm(100, 71, 2),
      ],
      0,
    )
    expect([...arrays.mismatchPositions]).toEqual([100, 100, 200, 300, 500])
  })

  it('carries every parallel array through the same permutation', () => {
    const arrays = buildMismatchArrays(
      [mm(300, 65, 7), mm(100, 67, 3), mm(200, 84, 5)],
      0,
    )
    // Each entry's base/strand/readIndex/qual must still describe ITS OWN
    // mismatch after the sort — a permutation applied to positions alone is the
    // failure this catches, and it would show as the wrong base at a position.
    expect([...arrays.mismatchPositions]).toEqual([100, 200, 300])
    expect([...arrays.mismatchBases]).toEqual([67, 84, 65])
    expect([...arrays.mismatchReadIndices]).toEqual([3, 5, 7])
    expect([...arrays.mismatchStrands]).toEqual([-1, -1, -1])
    expect([...arrays.mismatchQuals]).toEqual([33, 35, 37])
  })

  it('still drops entries before regionStart', () => {
    const arrays = buildMismatchArrays(
      [mm(300, 65, 0), mm(50, 67, 0), mm(200, 84, 1)],
      100,
    )
    expect([...arrays.mismatchPositions]).toEqual([200, 300])
    expect([...arrays.mismatchBases]).toEqual([84, 65])
  })

  it("emits no Y array — rows are the layout tier's", () => {
    // `cloneWithLayout` derives `mismatchYs` from the permuted
    // `mismatchReadIndices`, so it inherits this sort and must never be
    // permuted separately. Shipping a zeroed one from here made that look like
    // a field the worker owns.
    const arrays = buildMismatchArrays([mm(300, 65, 0), mm(100, 67, 1)], 0)
    expect(arrays).not.toHaveProperty('mismatchYs')
    expect([...arrays.mismatchReadIndices]).toEqual([1, 0])
  })

  it('handles the empty and single cases', () => {
    expect(buildMismatchArrays([], 0).mismatchPositions.length).toBe(0)
    expect([
      ...buildMismatchArrays([mm(42, 65, 0)], 0).mismatchPositions,
    ]).toEqual([42])
  })

  it('sorts a sparse spread, which takes the other sort', () => {
    // Wide span, few entries — `positionOrder`'s comparison-sort branch. Both
    // branches must produce the same ascending order.
    const arrays = buildMismatchArrays(
      [mm(90_000_000, 65, 0), mm(1000, 67, 1), mm(45_000_000, 84, 2)],
      0,
    )
    expect([...arrays.mismatchPositions]).toEqual([
      1000, 45_000_000, 90_000_000,
    ])
    expect([...arrays.mismatchBases]).toEqual([67, 84, 65])
  })
})
