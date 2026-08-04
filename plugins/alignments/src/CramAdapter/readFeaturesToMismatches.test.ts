import { arenaFromReadFeatures } from '@gmod/cram'

import { readFeaturesToMismatches } from './readFeaturesToMismatches.ts'

import type { ReadFeature } from '@gmod/cram'
import type { MismatchCallback } from '@jbrowse/cigar-utils'

interface Emit {
  type: number
  start: number
  length: number
  base: string
  cliplen: number | undefined
}

// Collect callback emissions into plain objects for assertion. featStart 0 and
// no window (±Infinity) keeps refPos == read-relative position. The fixtures are
// written as plain features and packed into a one-record arena, the columnar
// shape the walk reads.
function collect(readFeatures: ReadFeature[], qual?: Uint8Array) {
  const arena = arenaFromReadFeatures(readFeatures)
  const out: Emit[] = []
  const cb: MismatchCallback = (
    type,
    start,
    length,
    base,
    _q,
    _alt,
    cliplen,
  ) => {
    out.push({ type, start, length, base, cliplen })
  }
  readFeaturesToMismatches(
    arena,
    0,
    arena.length,
    0,
    qual,
    0,
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    cb,
  )
  return out
}

test('consecutive single-base i features merge into one insertion', () => {
  // Two 'i' bases inserted at the same refPos must collapse into a single
  // insertion of "AC" (regression: a lagged flush split & misplaced them).
  const out = collect([
    { code: 'i', data: 'A', pos: 2, refPos: 3 },
    { code: 'i', data: 'C', pos: 3, refPos: 3 },
  ])
  const insertions = out.filter(o => o.base === 'AC')
  expect(insertions).toHaveLength(1)
  expect(insertions[0]).toMatchObject({ start: 3, cliplen: 2 })
})

test('a Q between two i features does not split the insertion', () => {
  // q/Q report where a quality score sits in the *read*, so the Q that follows
  // an inserted base carries a refPos behind the insertion — see RF_POSITIONAL
  // in @gmod/cram. Letting it through flushed the accumulator here and emitted
  // two 1-base insertions at the same position instead of one 2-base insertion.
  const out = collect([
    { code: 'i', data: 'A', pos: 2, refPos: 3 },
    { code: 'Q', data: 36, pos: 2, refPos: 2 },
    { code: 'i', data: 'C', pos: 3, refPos: 3 },
  ])
  expect(out).toHaveLength(1)
  expect(out[0]).toMatchObject({ start: 3, base: 'AC', cliplen: 2 })
})

test('insertion is emitted before a same-position mismatch', () => {
  // readFeatures order is i then X at the same refPos; the accumulated insertion
  // must flush before the mismatch so ordering matches the BAM path.
  const out = collect(
    [
      { code: 'i', data: 'A', pos: 3, refPos: 5 },
      { code: 'X', data: 0, pos: 3, refPos: 5, sub: 'C', ref: 'G' },
    ],
    new Uint8Array([0, 0, 0, 30]),
  )
  expect(out.map(o => o.base)).toEqual(['A', 'C'])
  expect(out.map(o => o.start)).toEqual([5, 5])
})

test('two i insertions at different refPos stay separate', () => {
  const out = collect([
    { code: 'i', data: 'A', pos: 1, refPos: 2 },
    { code: 'X', data: 0, pos: 2, refPos: 4, sub: 'T', ref: 'A' },
    { code: 'i', data: 'G', pos: 4, refPos: 7 },
  ])
  expect(out).toEqual([
    { type: expect.any(Number), start: 2, length: 0, base: 'A', cliplen: 1 },
    { type: expect.any(Number), start: 4, length: 1, base: 'T', cliplen: 0 },
    { type: expect.any(Number), start: 7, length: 0, base: 'G', cliplen: 1 },
  ])
})

test('trailing accumulated insertion is flushed at loop end', () => {
  const out = collect([
    { code: 'X', data: 0, pos: 0, refPos: 1, sub: 'C', ref: 'A' },
    { code: 'i', data: 'T', pos: 1, refPos: 3 },
    { code: 'i', data: 'T', pos: 2, refPos: 3 },
  ])
  expect(out.at(-1)).toMatchObject({ start: 3, base: 'TT', cliplen: 2 })
})
