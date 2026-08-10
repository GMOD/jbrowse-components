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

// A CIGAR that reports how many ops the walk actually touched. The whole point
// of the block below is work avoided, and the result is `undefined` either way,
// so counting reads is the only way to state it.
function countingCigar(c: Uint32Array) {
  let reads = 0
  const proxy = new Proxy(c, {
    get(target, prop) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        reads++
      }
      // No `receiver`: a typed array's length/index getters read internal slots
      // and reject the proxy as `this`.
      return Reflect.get(target, prop) as unknown
    },
  })
  return { proxy, reads: () => reads }
}

test('a block starting past the window stops at the first op', () => {
  // Query ascends monotonically, so the first op already settles it. The break
  // used to require `out.length`, which is never satisfied here — so this input,
  // a whole liftOver chain fetched into the pan buffer but sitting right of the
  // visible window, read every op to reach the same answer. That is the longest
  // walk the function has, on the one input whose answer is immediate.
  const ops = Array.from(
    { length: 5000 },
    () => [10, CIGAR_M] as [number, number],
  )
  const { proxy, reads } = countingCigar(cig(...ops))
  expect(clipSyntenyFeature(proxy, 1000, 0, 50000, 1, 0, 100)).toBeUndefined()
  expect(reads()).toBeLessThanOrEqual(2)
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

  // The block's own span is tested against the window before the CIGAR string is
  // parsed, which saves a parse of a multi-megabyte string for every block the
  // viewport cull is about to drop anyway (a whole band of them: syntenyFetchRegions
  // snaps the fetch window OUTWARD to a buffer-sized grid so panning within a cell
  // doesn't refetch, while the cull window is only the viewport plus one buffer).
  //
  // Being a pure short-circuit, the saving itself is unobservable from out here —
  // what these pin is the part that could be WRONG, that it reaches the same answer
  // the walk it skips would. Every op the walk keeps has to overlap the window and
  // the walk only moves forward from `start`, so a block on either side keeps
  // nothing; both directions are checked against the walk itself.
  test.each([
    ['left of the window', 250000, 251000],
    ['right of the window', 1000, 2000],
  ])('a block %s clips to nothing, as walking it would', (_n, lo, hi) => {
    // A 1000 bp block on a region that shows 300 kb, so the window lands well
    // clear of it on one side or the other.
    const smallBlock = {
      ...bigBlock,
      start: 100000,
      end: 101000,
      mateStart: 100000,
      mateEnd: 101000,
      cigar: '1000M',
    }
    const args = {
      ...smallBlock,
      v1Index: v1({ refName: 'chr1', start: 0, end: 300000 }),
      refName: 'chr1',
      winCumLo: lo,
      winCumHi: hi,
    }
    expect(clipLargeBlockToWindow(args)).toBeUndefined()
    // and the walk it short-circuits agrees
    expect(
      clipSyntenyFeature(
        cig([1000, CIGAR_M]),
        smallBlock.start,
        smallBlock.mateStart,
        smallBlock.mateEnd,
        smallBlock.strand,
        lo,
        hi,
      ),
    ).toBeUndefined()
  })

  // The gate is on the BLOCK's span, not the window's, so a block that does
  // reach the window is still clipped normally.
  test('a block overlapping the window is still clipped', () => {
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
})
