import { IdentityColumns, identityColor } from './drawRowIdentity.ts'

// test only
// eslint-disable-next-line  @typescript-eslint/no-misused-spread
const bytes = (s: string) => new Uint8Array([...s].map(c => c.charCodeAt(0)))

// one pixel per bp, wide enough that nothing clamps
const identityMapper = (bp: number) => bp

// Build one block's columns and splat a single row through them — the two-call
// shape `drawRowIdentity` uses per block, collapsed for the single-row cases
// below.
function accumulateRowIdentity(
  matchSum: Float32Array,
  classCount: Float32Array,
  rowBase: number,
  refBytes: Uint8Array,
  alignmentBytes: Uint8Array,
  startBp: number,
  bpToX: (bp: number) => number,
  xLo: number,
  xHi: number,
) {
  const columns = new IdentityColumns()
  columns.build(refBytes, startBp, bpToX, xLo, xHi)
  columns.accumulate(matchSum, classCount, rowBase, alignmentBytes)
}

test('matches vs mismatches against the reference', () => {
  const match = new Float32Array(4)
  const cls = new Float32Array(4)
  accumulateRowIdentity(
    match,
    cls,
    0,
    bytes('ACGT'),
    bytes('ACGA'),
    0,
    identityMapper,
    0,
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
    0,
    bytes('ACGT'),
    bytes('A-GT'),
    0,
    identityMapper,
    0,
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
    0,
    bytes('A-CG'),
    bytes('ATCG'),
    0,
    identityMapper,
    0,
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
    0,
    bytes('NA'),
    bytes('CA'),
    0,
    identityMapper,
    0,
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
    0,
    bytes('AC'),
    bytes('ac'),
    0,
    identityMapper,
    0,
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
    0,
    bytes('ACGT'),
    bytes('ATGT'),
    0,
    bp => bp / 4,
    0,
    1,
  )
  expect(cls[0]).toBe(4)
  expect(match[0]).toBe(3)
})

// The bound is the owning block's scissor span — see the matching test in
// drawConservation.test.ts for why the canvas width is not the right bound.
test('bases outside the block scissor span do not bleed into neighbors', () => {
  const match = new Float32Array(6)
  const cls = new Float32Array(6)
  accumulateRowIdentity(
    match,
    cls,
    0,
    bytes('ACGTAC'),
    bytes('ACGTAC'),
    0,
    identityMapper,
    2,
    4,
  )
  expect(Array.from(cls)).toEqual([0, 0, 1, 1, 0, 0])
  expect(Array.from(match)).toEqual([0, 0, 1, 1, 0, 0])
})

// The draw pass hands one flat row-major buffer to every row, so a row must
// only ever touch its own [rowBase, rowBase + width) slice.
test('rowBase confines a row to its slice of the shared accumulators', () => {
  const match = new Float32Array(6)
  const cls = new Float32Array(6)
  accumulateRowIdentity(
    match,
    cls,
    3,
    bytes('ACG'),
    bytes('ATG'),
    0,
    identityMapper,
    0,
    3,
  )
  expect(Array.from(cls)).toEqual([0, 0, 0, 1, 1, 1])
  expect(Array.from(match)).toEqual([0, 0, 0, 1, 0, 1])
})

// The column buffers outlive one block (they're reused for the whole draw
// pass), so a shorter block must not read the previous block's tail.
test('rebuilding for a shorter block does not leak the previous block', () => {
  const columns = new IdentityColumns()
  columns.build(bytes('ACGTAC'), 0, identityMapper, 0, 6)
  columns.build(bytes('AC'), 0, identityMapper, 0, 6)
  const match = new Float32Array(6)
  const cls = new Float32Array(6)
  columns.accumulate(match, cls, 0, bytes('AC'))
  expect(Array.from(cls)).toEqual([1, 1, 0, 0, 0, 0])
  expect(Array.from(match)).toEqual([1, 1, 0, 0, 0, 0])
})

// A row shorter than the reference has no data past its end, so those columns
// are absent rather than mismatched — matching where `renderBases` and
// `buildInstanceBuffer` stop. Read as mismatches, a truncated row drew as a
// solid 0%-identity (divergent red) band instead of dropping out.
test('a row shorter than the reference is absent past its end, not mismatched', () => {
  const match = new Float32Array(4)
  const cls = new Float32Array(4)
  accumulateRowIdentity(
    match,
    cls,
    0,
    bytes('ACGT'),
    bytes('AC'),
    0,
    identityMapper,
    0,
    4,
  )
  expect(Array.from(cls)).toEqual([1, 1, 0, 0])
  expect(Array.from(match)).toEqual([1, 1, 0, 0])
})

test('identityColor ramps from divergent red through grey to conserved blue', () => {
  expect(identityColor(0)).toEqual([199, 67, 56])
  expect(identityColor(0.5)).toEqual([140, 140, 140])
  expect(identityColor(1)).toEqual([47, 102, 176])
})

test('identityColor clamps out-of-range input', () => {
  expect(identityColor(-1)).toEqual([199, 67, 56])
  expect(identityColor(2)).toEqual([47, 102, 176])
})
