import { CIGAR_D, CIGAR_I, CIGAR_M } from '@jbrowse/cigar-utils'
import { buildBpRegionIndex } from '@jbrowse/synteny-core'

import {
  clipLargeBlockToWindow,
  clipSyntenyFeature,
} from './clipSyntenyFeature.ts'

import type { Region } from '@jbrowse/core/util'

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
    0,
    240,
    1,
    90,
    130,
  )!
  // the I op survives intact (its 40 target bp are the insertion)
  const hasFullI = [...c.cigar].some(
    p => (p & 0xf) === CIGAR_I && p >>> 4 === 40,
  )
  expect(hasFullI).toBe(true)
  expect(c.start).toBe(90)
  expect(c.end).toBe(130)
})

test('block entirely outside the window returns undefined', () => {
  expect(
    clipSyntenyFeature(cig([100, CIGAR_M]), 0, 0, 100, 1, 500, 600),
  ).toBeUndefined()
})

// clipLargeBlockToWindow maps the pixel-derived cumBp window back to the v1
// region's local bp before clipping. In a reversed display region bpToCumBp runs
// backward (cumBp = end - coord within the region), so the window mapping must
// mirror — an earlier version bailed out on reversed regions entirely, dropping
// the whole (huge) block off-screen at high zoom.
describe('clipLargeBlockToWindow window mapping', () => {
  const v1 = (...regions: Omit<Region, 'assemblyName'>[]) =>
    buildBpRegionIndex({
      bpPerPx: 1,
      minimumBlockWidth: 0,
      displayedRegions: regions.map(r => ({ assemblyName: 'q', ...r })),
    })

  // A 300 kb block (M300000) far larger than a ~100 bp visible window: the clip
  // re-anchors it to the window. Forward and reversed regions covering the same
  // genomic locus must trim to the same genomic query slice.
  const bigBlock = {
    start: 0,
    end: 300000,
    mateStart: 0,
    mateEnd: 300000,
    strand: 1,
    cigar: `300000M`,
    windowSpan: 100,
    spanRatio: 4,
  }

  test('forward region maps the low cumBp bound to the low local bp', () => {
    // cumBp window [1000,1100] on a region starting at genomic 0 -> local
    // [1000,1100].
    const c = clipLargeBlockToWindow({
      ...bigBlock,
      v1Index: v1({ refName: 'chr1', start: 0, end: 300000 }),
      refName: 'chr1',
      winCumLo: 1000,
      winCumHi: 1100,
    })
    expect(c?.start).toBe(1000)
    expect(c?.end).toBe(1100)
  })

  test('reversed region mirrors the window onto the local bp', () => {
    // Same cumBp window [1000,1100], but a reversed region [0,300000]: cumBp c
    // maps to local end-c, so the low cumBp (1000) is the HIGH local bp
    // (300000-1000=299000) and vice versa -> local [298900,299000].
    const c = clipLargeBlockToWindow({
      ...bigBlock,
      v1Index: v1({ refName: 'chr1', start: 0, end: 300000, reversed: true }),
      refName: 'chr1',
      winCumLo: 1000,
      winCumHi: 1100,
    })
    expect(c?.start).toBe(298900)
    expect(c?.end).toBe(299000)
  })

  // Dispersed gene duplication: the same contig shown at two disjoint loci. The
  // block projects into whichever region the viewport is over — here the second
  // (chr1:200000-201000, cumBp [1000,2000]). The window must re-anchor against
  // THAT region, not the first (which an earlier length===1 gate skipped).
  test('picks the disjoint region the window overlaps', () => {
    const c = clipLargeBlockToWindow({
      ...bigBlock,
      v1Index: v1(
        { refName: 'chr1', start: 0, end: 1000 },
        { refName: 'chr1', start: 200000, end: 201000 },
      ),
      refName: 'chr1',
      // cumBp [1400,1500] sits in the second region -> local
      // [1400-1000+200000, 1500-1000+200000] = [200400,200500].
      winCumLo: 1400,
      winCumHi: 1500,
    })
    expect(c?.start).toBe(200400)
    expect(c?.end).toBe(200500)
  })

  // A window over none of the refName's regions (both off-screen) leaves the
  // block untouched rather than clipping to an off-screen slice.
  test('returns undefined when the window overlaps no region', () => {
    const c = clipLargeBlockToWindow({
      ...bigBlock,
      v1Index: v1({ refName: 'chr1', start: 0, end: 1000 }),
      refName: 'chr1',
      winCumLo: 50000,
      winCumHi: 51000,
    })
    expect(c).toBeUndefined()
  })
})
