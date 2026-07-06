import { CIGAR_D, CIGAR_I, CIGAR_M } from '@jbrowse/cigar-utils'

import { clipSyntenyFeature } from './clipSyntenyFeature.ts'

const pack = (len: number, op: number) => (len << 4) | op
const cig = (...ops: [number, number][]) =>
  Uint32Array.from(ops.map(([l, o]) => pack(l, o)))

// D consumes query (v1) but not target (v2) in this per-perspective convention,
// so query [0,300] with M100 D50 M150 maps target 0..100 (M), stays 100 (D),
// 100..250 (M); mate span [0,250].
test('+ strand: trims flanking match ops and re-anchors mate coords', () => {
  const c = clipSyntenyFeature(
    cig([100, CIGAR_M], [50, CIGAR_D], [150, CIGAR_M]),
    0, // start
    300, // end
    0, // mateStart
    250, // mateEnd
    1, // strand
    80, // winStart
    170, // winEnd
  )
  expect(c).toEqual({
    start: 80,
    end: 170,
    mateStart: 80,
    mateEnd: 120,
    cigar: cig([20, CIGAR_M], [50, CIGAR_D], [20, CIGAR_M]),
  })
})

// The query (v1) axis is ALWAYS walked forward — buildSyntenyGeometry's rev1 is
// +1 regardless of strand; only the target (v2) axis flips. So a - strand block
// keeps the CIGAR in file order and trims by the same query window as +; only
// the mate coords count down (target decreases as query increases).
//
// Full - strand walk of M100 D50 M150 (query 0..300, target 250..0): the D sits
// at query [100,150] with target pinned at 150. Window [80,170] keeps that D
// whole and clips the flanking matches to 20 bp each. The visible target range
// is 170 (at q=80) down to 130 (at q=170).
test('- strand: keeps the indel at its true query position, target counts down', () => {
  const c = clipSyntenyFeature(
    cig([100, CIGAR_M], [50, CIGAR_D], [150, CIGAR_M]),
    0,
    300,
    0,
    250,
    -1,
    80,
    170,
  )
  expect(c).toEqual({
    start: 80,
    end: 170,
    mateStart: 130,
    mateEnd: 170,
    cigar: cig([20, CIGAR_M], [50, CIGAR_D], [20, CIGAR_M]),
  })
})

test('I op (target-consuming) inside the window is kept whole', () => {
  // M100 I40 M100: query advances 0..100 then (I consumes target only) stays
  // 100, then 100..200. Window covers the insertion point.
  const c = clipSyntenyFeature(
    cig([100, CIGAR_M], [40, CIGAR_I], [100, CIGAR_M]),
    0,
    200,
    0,
    240,
    1,
    90,
    130,
  )!
  // the I op survives intact (its 40 target bp are the insertion)
  const hasFullI = [...c.cigar].some(p => (p & 0xf) === CIGAR_I && p >>> 4 === 40)
  expect(hasFullI).toBe(true)
  expect(c.start).toBe(90)
  expect(c.end).toBe(130)
})

test('block entirely outside the window returns undefined', () => {
  expect(
    clipSyntenyFeature(cig([100, CIGAR_M]), 0, 100, 0, 100, 1, 500, 600),
  ).toBeUndefined()
})
