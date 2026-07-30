import { alignedExtent, resolvedExtent } from './alignedExtent.ts'

import type { RowFlank } from './rowFlank.ts'

const enc = new TextEncoder()
const extent = (s: string) => alignedExtent(enc.encode(s))

const UNBOUNDED: RowFlank = { boundedLeft: false, boundedRight: false }
const LEFT: RowFlank = { boundedLeft: true, boundedRight: false }
const RIGHT: RowFlank = { boundedLeft: false, boundedRight: true }
const BOTH: RowFlank = { boundedLeft: true, boundedRight: true }

const resolved = (s: string, flank: RowFlank) =>
  resolvedExtent(enc.encode(s), s.length, flank)

describe('alignedExtent', () => {
  test('a fully aligned row spans every column', () => {
    expect(extent('acgt')).toEqual({ firstCol: 0, lastCol: 3 })
  })

  test('boundary gaps are outside the extent', () => {
    expect(extent('--cg--')).toEqual({ firstCol: 2, lastCol: 3 })
  })

  test('interior gaps are inside the extent', () => {
    expect(extent('a--t')).toEqual({ firstCol: 0, lastCol: 3 })
  })

  test('missing data counts as unaligned at the boundary too', () => {
    expect(extent('  cg  ')).toEqual({ firstCol: 2, lastCol: 3 })
  })

  test('a single aligned column is its own extent', () => {
    expect(extent('---a---')).toEqual({ firstCol: 3, lastCol: 3 })
  })

  test('an all-gap row has no extent', () => {
    expect(extent('----')).toEqual({ firstCol: -1, lastCol: -1 })
  })

  test('an empty row has no extent', () => {
    expect(extent('')).toEqual({ firstCol: -1, lastCol: -1 })
  })

  test('len bounds the scan to the shared prefix with the reference', () => {
    // forEachDeletion passes min(ref.length, aln.length), so bases past the
    // reference must not extend the extent
    expect(alignedExtent(enc.encode('ac--gt'), 4)).toEqual({
      firstCol: 0,
      lastCol: 1,
    })
  })
})

describe('resolvedExtent', () => {
  test('with no neighbour to consult it is the aligned extent', () => {
    expect(resolved('--cg--', UNBOUNDED)).toEqual({ firstCol: 2, lastCol: 3 })
  })

  test('a bounded side extends to the block edge', () => {
    expect(resolved('--cg--', LEFT)).toEqual({ firstCol: 0, lastCol: 3 })
    expect(resolved('--cg--', RIGHT)).toEqual({ firstCol: 2, lastCol: 5 })
    expect(resolved('--cg--', BOTH)).toEqual({ firstCol: 0, lastCol: 5 })
  })

  test('an all-gap row resolves only when both sides close it', () => {
    expect(resolved('----', BOTH)).toEqual({ firstCol: 0, lastCol: 3 })
    expect(resolved('----', LEFT)).toEqual({ firstCol: -1, lastCol: -1 })
    expect(resolved('----', RIGHT)).toEqual({ firstCol: -1, lastCol: -1 })
    expect(resolved('----', UNBOUNDED)).toEqual({ firstCol: -1, lastCol: -1 })
  })
})
