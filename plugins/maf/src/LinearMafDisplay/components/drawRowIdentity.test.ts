import { accumulateRowIdentity, identityColor } from './drawRowIdentity.ts'

// test only
// eslint-disable-next-line  @typescript-eslint/no-misused-spread
const bytes = (s: string) => new Uint8Array([...s].map(c => c.charCodeAt(0)))

// one pixel per bp, wide enough that nothing clamps
const identityMapper = (bp: number) => bp

test('matches vs mismatches against the reference', () => {
  const match = new Float32Array(4)
  const cls = new Float32Array(4)
  accumulateRowIdentity(
    match,
    cls,
    bytes('ACGT'),
    bytes('ACGA'),
    0,
    identityMapper,
    4,
  )
  expect(Array.from(cls)).toEqual([1, 1, 1, 1])
  expect(Array.from(match)).toEqual([1, 1, 1, 0])
})

test('sample gaps are excluded from the denominator', () => {
  const match = new Float32Array(4)
  const cls = new Float32Array(4)
  accumulateRowIdentity(
    match,
    cls,
    bytes('ACGT'),
    bytes('A-GT'),
    0,
    identityMapper,
    4,
  )
  expect(Array.from(cls)).toEqual([1, 0, 1, 1])
  expect(Array.from(match)).toEqual([1, 0, 1, 1])
})

test('reference insertion columns (ref dash) consume no ref position', () => {
  const match = new Float32Array(3)
  const cls = new Float32Array(3)
  // ref A-CG: the middle column is a sample insertion, skipped; ref positions
  // are A(0) C(1) G(2).
  accumulateRowIdentity(
    match,
    cls,
    bytes('A-CG'),
    bytes('ATCG'),
    0,
    identityMapper,
    3,
  )
  expect(Array.from(cls)).toEqual([1, 1, 1])
  expect(Array.from(match)).toEqual([1, 1, 1])
})

test('reference N columns are unclassifiable', () => {
  const match = new Float32Array(2)
  const cls = new Float32Array(2)
  accumulateRowIdentity(
    match,
    cls,
    bytes('NA'),
    bytes('CA'),
    0,
    identityMapper,
    2,
  )
  expect(Array.from(cls)).toEqual([0, 1])
  expect(Array.from(match)).toEqual([0, 1])
})

test('comparison is case-insensitive (soft-masking ignored)', () => {
  const match = new Float32Array(2)
  const cls = new Float32Array(2)
  accumulateRowIdentity(
    match,
    cls,
    bytes('AC'),
    bytes('ac'),
    0,
    identityMapper,
    2,
  )
  expect(Array.from(match)).toEqual([1, 1])
})

test('zoomed out: several bases average into one pixel', () => {
  const match = new Float32Array(1)
  const cls = new Float32Array(1)
  // 4 bp per pixel; matches at 1,0,1,1 → 3/4.
  accumulateRowIdentity(
    match,
    cls,
    bytes('ACGT'),
    bytes('ATGT'),
    0,
    bp => bp / 4,
    1,
  )
  expect(cls[0]).toBe(4)
  expect(match[0]).toBe(3)
})

test('identityColor ramps from divergent red to conserved green', () => {
  expect(identityColor(0)).toEqual([215, 48, 39])
  expect(identityColor(0.5)).toEqual([255, 255, 191])
  expect(identityColor(1)).toEqual([26, 152, 80])
})

test('identityColor clamps out-of-range input', () => {
  expect(identityColor(-1)).toEqual([215, 48, 39])
  expect(identityColor(2)).toEqual([26, 152, 80])
})
