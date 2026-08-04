import { blockIndexAtBp } from './blockAtBp.ts'

// Disjoint, ascending, with a reference gap between the 2nd and 3rd — the
// shape a real fetched region has (blocks are one MAF stanza each, separated
// wherever the alignment does not cover the reference).
const blocks = [
  { startBp: 100, endBp: 110 },
  { startBp: 110, endBp: 130 },
  { startBp: 200, endBp: 205 },
]

test('finds the covering block', () => {
  expect(blockIndexAtBp(blocks, 100)).toBe(0)
  expect(blockIndexAtBp(blocks, 109)).toBe(0)
  expect(blockIndexAtBp(blocks, 110)).toBe(1)
  expect(blockIndexAtBp(blocks, 129)).toBe(1)
  expect(blockIndexAtBp(blocks, 204)).toBe(2)
})

test('no block covers a position in a gap, before, or after', () => {
  expect(blockIndexAtBp(blocks, 99)).toBe(-1)
  expect(blockIndexAtBp(blocks, 130)).toBe(-1)
  expect(blockIndexAtBp(blocks, 199)).toBe(-1)
  expect(blockIndexAtBp(blocks, 205)).toBe(-1)
})

test('empty block list', () => {
  expect(blockIndexAtBp([], 100)).toBe(-1)
})

// The binary search has to agree with a scan at every position, including the
// boundaries — an off-by-one here silently drops the hover on the first or last
// base of a block.
test('agrees with a linear scan across the whole span', () => {
  for (let bp = 95; bp < 210; bp++) {
    const scanned = blocks.findIndex(b => bp >= b.startBp && bp < b.endBp)
    expect(blockIndexAtBp(blocks, bp)).toBe(scanned)
  }
})
