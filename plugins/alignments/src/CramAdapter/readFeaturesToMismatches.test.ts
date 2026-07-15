import { readFeaturesToMismatches } from './readFeaturesToMismatches.ts'

import type { CramRecord } from '@gmod/cram'
import type { MismatchCallback } from '@jbrowse/cigar-utils'

type ReadFeatures = CramRecord['readFeatures']

interface Emit {
  type: number
  start: number
  length: number
  base: string
  cliplen: number | undefined
}

// Collect callback emissions into plain objects for assertion. featStart 0 and
// no window (±Infinity) keeps refPos == read-relative position.
function collect(readFeatures: ReadFeatures, qual?: Uint8Array) {
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
    readFeatures,
    0,
    qual,
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
    { code: 'i', data: 'A', pos: 3, refPos: 4 },
    { code: 'i', data: 'C', pos: 4, refPos: 4 },
  ])
  const insertions = out.filter(o => o.base === 'AC')
  expect(insertions).toHaveLength(1)
  expect(insertions[0]).toMatchObject({ start: 3, cliplen: 2 })
})

test('insertion is emitted before a same-position mismatch', () => {
  // readFeatures order is i then X at the same refPos; the accumulated insertion
  // must flush before the mismatch so ordering matches the BAM path.
  const out = collect(
    [
      { code: 'i', data: 'A', pos: 4, refPos: 6 },
      { code: 'X', data: 0, pos: 4, refPos: 6, sub: 'C', ref: 'G' },
    ],
    new Uint8Array([0, 0, 0, 30]),
  )
  expect(out.map(o => o.base)).toEqual(['A', 'C'])
  expect(out.map(o => o.start)).toEqual([5, 5])
})

test('two i insertions at different refPos stay separate', () => {
  const out = collect([
    { code: 'i', data: 'A', pos: 2, refPos: 3 },
    { code: 'X', data: 0, pos: 3, refPos: 5, sub: 'T', ref: 'A' },
    { code: 'i', data: 'G', pos: 5, refPos: 8 },
  ])
  expect(out).toEqual([
    { type: expect.any(Number), start: 2, length: 0, base: 'A', cliplen: 1 },
    { type: expect.any(Number), start: 4, length: 1, base: 'T', cliplen: 0 },
    { type: expect.any(Number), start: 7, length: 0, base: 'G', cliplen: 1 },
  ])
})

test('trailing accumulated insertion is flushed at loop end', () => {
  const out = collect([
    { code: 'X', data: 0, pos: 1, refPos: 2, sub: 'C', ref: 'A' },
    { code: 'i', data: 'T', pos: 2, refPos: 4 },
    { code: 'i', data: 'T', pos: 3, refPos: 4 },
  ])
  expect(out.at(-1)).toMatchObject({ start: 3, base: 'TT', cliplen: 2 })
})
