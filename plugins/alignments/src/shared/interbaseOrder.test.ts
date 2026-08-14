import { buildInterbaseArrays } from './buildInterbaseArrays.ts'
import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from './types.ts'
import { interbaseRangeEnds } from './uploadTypes.ts'

// `interbasePositions` is ascending WITHIN each of its three blocks and not
// across them. Both halves are contracts:
//
//   - sorted inside a block, so `forEachAtPosition` can binary-search it and the
//     interbase hover readers keep no side index;
//   - grouped as (insertions, softclips, hardclips) with the counts intact, so
//     `insertion/packGpu.ts`, `shared/clipPass.ts` and `shared/uploadTypes.ts`
//     keep slicing subranges without re-scanning `interbaseTypes`.
//
// A change that sorted the whole array would satisfy the first and break the
// second, silently, by drawing the wrong marks. This test holds both.
const ins = (position: number, length: number, readIndex = 0) => ({
  position,
  length,
  readIndex,
  sequence: `ins${position}`,
})
const clip = (position: number, length: number, readIndex = 0) => ({
  position,
  length,
  readIndex,
  clipStart: position,
})

describe('buildInterbaseArrays ordering', () => {
  it('sorts within each block and keeps the block layout', () => {
    const r = buildInterbaseArrays(
      [ins(300, 3), ins(100, 1), ins(200, 2)],
      [clip(90, 9), clip(50, 5)],
      [clip(700, 7), clip(600, 6)],
      0,
    )
    // Ascending inside each run; NOT ascending across the whole array (100 <
    // 200 < 300, then it drops to 50).
    expect([...r.interbasePositions]).toEqual([100, 200, 300, 50, 90, 600, 700])
    expect(r.numInsertions).toBe(3)
    expect(r.numSoftclips).toBe(2)
    expect(r.numHardclips).toBe(2)
    const { insEnd, scEnd, hcEnd } = interbaseRangeEnds(r)
    expect([insEnd, scEnd, hcEnd]).toEqual([3, 5, 7])
    // Each block still holds only its own type, which is what the three GPU
    // passes slice on.
    expect([...r.interbaseTypes.subarray(0, insEnd)]).toEqual([
      INTERBASE_INSERTION,
      INTERBASE_INSERTION,
      INTERBASE_INSERTION,
    ])
    expect([...r.interbaseTypes.subarray(insEnd, scEnd)]).toEqual([
      INTERBASE_SOFTCLIP,
      INTERBASE_SOFTCLIP,
    ])
    expect([...r.interbaseTypes.subarray(scEnd, hcEnd)]).toEqual([
      INTERBASE_HARDCLIP,
      INTERBASE_HARDCLIP,
    ])
  })

  it('carries every parallel array through the same permutation', () => {
    const r = buildInterbaseArrays(
      [ins(300, 33, 7), ins(100, 11, 3)],
      [clip(90, 99, 5)],
      [],
      0,
    )
    expect([...r.interbasePositions]).toEqual([100, 300, 90])
    expect([...r.interbaseLengths]).toEqual([11, 33, 99])
    expect([...r.interbaseReadIndices]).toEqual([3, 7, 5])
    // The sequence array is a string[] and must be permuted with the rest — a
    // tooltip naming the wrong inserted bases is the failure this catches.
    expect(r.interbaseSequences).toEqual(['ins100', 'ins300', ''])
  })

  it('drops entries before regionStart without disturbing the layout', () => {
    const r = buildInterbaseArrays(
      [ins(300, 3), ins(50, 1), ins(200, 2)],
      [clip(40, 4), clip(150, 5)],
      [],
      100,
    )
    expect([...r.interbasePositions]).toEqual([200, 300, 150])
    expect(r.numInsertions).toBe(2)
    expect(r.numSoftclips).toBe(1)
    expect(r.numHardclips).toBe(0)
  })

  it('handles empty blocks, including an empty middle one', () => {
    const r = buildInterbaseArrays(
      [ins(20, 2), ins(10, 1)],
      [],
      [clip(5, 5)],
      0,
    )
    expect([...r.interbasePositions]).toEqual([10, 20, 5])
    const { insEnd, scEnd, hcEnd } = interbaseRangeEnds(r)
    expect([insEnd, scEnd, hcEnd]).toEqual([2, 2, 3])
    expect(buildInterbaseArrays([], [], [], 0).interbasePositions.length).toBe(
      0,
    )
  })

  it('sorts a sparse spread, which takes the other sort branch', () => {
    const r = buildInterbaseArrays(
      [ins(90_000_000, 3), ins(1000, 1), ins(45_000_000, 2)],
      [],
      [],
      0,
    )
    expect([...r.interbasePositions]).toEqual([1000, 45_000_000, 90_000_000])
    expect([...r.interbaseLengths]).toEqual([1, 2, 3])
  })
})
