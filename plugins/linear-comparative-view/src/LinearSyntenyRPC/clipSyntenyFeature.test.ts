import {
  CIGAR_D,
  CIGAR_H,
  CIGAR_I,
  CIGAR_M,
  CIGAR_RUN,
  CIGAR_S,
  visitCigarRenderedSegments,
} from '@jbrowse/cigar-utils'
import { buildBpRegionIndex } from '@jbrowse/synteny-core'

import {
  clipLargeBlockToWindow,
  clipSyntenyFeature,
} from './clipSyntenyFeature.ts'

import type { ClippedSyntenyFeature } from './clipSyntenyFeature.ts'
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

// Where the two ends of the clipped block ACTUALLY land once the renderer walks
// the CIGAR this returned. That is the only consumer of the output, so it is the
// only thing that says whether the clip is self-consistent — an expected-CIGAR
// assertion restates the walk instead of checking it, which is how a clip whose
// ops disagree with `visitCigarRenderedSegments` about H/S/P passed for as long
// as it did.
function walkedSpans(c: ClippedSyntenyFeature, strand: number) {
  let q1 = Infinity
  let q2 = -Infinity
  let t1 = Infinity
  let t2 = -Infinity
  visitCigarRenderedSegments(
    c.cigar,
    c.start,
    strand === -1 ? c.mateEnd : c.mateStart,
    1,
    1,
    1,
    strand,
    (_op, qs, qe, ts, te) => {
      q1 = Math.min(q1, qs, qe)
      q2 = Math.max(q2, qs, qe)
      t1 = Math.min(t1, ts, te)
      t2 = Math.max(t2, ts, te)
    },
  )
  return { query: [q1, q2], target: [t1, t2] }
}

// A BAM CIGAR reaches here through "Linear read vs ref", which hands the read's
// raw CIGAR over verbatim while putting the mate in read coordinates that
// already exclude the clip. So a clip op advances NEITHER axis, and treating it
// as advancing both walked the block 100bp along each past its own corners.
test('a leading soft clip advances neither axis', () => {
  const c = clipSyntenyFeature(
    cig([100, CIGAR_S], [1000, CIGAR_M]),
    5000, // start (v1 / ref axis)
    100, // mateStart — clip-exclusive read coords, per buildReadVsRefFeatures
    1100, // mateEnd
    1,
    5000, // winStart
    5500, // winEnd
  )!
  expect(c).toEqual({
    start: 5000,
    end: 5500,
    mateStart: 100,
    mateEnd: 600,
    cigar: cig([500, CIGAR_M]),
  })
  // ...and the walk agrees with the corners it reports, on both axes. Before the
  // fix the clip kept a 100S and only 400M, so this said [5000, 5400] / [100,
  // 500] — a 100bp shortfall at the trailing end of every tile and marker.
  expect(walkedSpans(c, 1)).toEqual({
    query: [5000, 5500],
    target: [100, 600],
  })
})

test('a trailing hard clip is not a block of its own', () => {
  // The match trims to nothing (the window starts exactly at its end), so the
  // clip is the only op that could be collected. Counting it as query-consuming
  // returned a 200bp-wide block with a zero-width target — a spike, drawn in
  // place of the real one, since the caller overwrites the block's coords with
  // whatever this answers.
  expect(
    clipSyntenyFeature(
      cig([1000, CIGAR_M], [200, CIGAR_H]),
      5000,
      0,
      1000,
      1,
      6000,
      6500,
    ),
  ).toBeUndefined()
})

test('- strand: a leading soft clip advances neither axis', () => {
  // Same block reversed: the query still walks forward, the target counts down
  // from mateEnd, and the clip must move neither.
  const c = clipSyntenyFeature(
    cig([100, CIGAR_S], [1000, CIGAR_M]),
    5000,
    100,
    1100,
    -1,
    5000,
    5500,
  )!
  expect(c).toEqual({
    start: 5000,
    end: 5500,
    mateStart: 600,
    mateEnd: 1100,
    cigar: cig([500, CIGAR_M]),
  })
  expect(walkedSpans(c, -1)).toEqual({
    query: [5000, 5500],
    target: [600, 1100],
  })
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

  // The pre-gate reads the block's DECLARED end, while the walk it replaces
  // reads the CIGAR. Those agree only while the CIGAR's query span is
  // `end - start`, which is an assumption the walk never had to make — so this
  // pins where the two part company, in both directions, rather than leaving it
  // to be rediscovered from a bug report.
  //
  // The assumption is one-sided, and only the LEFT half of the gate carries it.
  describe('the pre-gate trusts `end`, and the walk trusts the CIGAR', () => {
    // Query span 50000 against a declared span of 1000: the block's ops reach
    // 150000 while `end` claims 101000. With the window past `end` but inside
    // the CIGAR's true reach, the gate says "left of the window" and the walk
    // disagrees. Deliberate — every other consumer already mis-draws a block
    // whose CIGAR overruns its own coordinates — but it IS new, so it is pinned.
    const overrunning = {
      ...bigBlock,
      start: 100000,
      end: 101000,
      mateStart: 100000,
      mateEnd: 150000,
      cigar: '50000M',
    }

    test('left of the window: the gate drops what the walk would keep', () => {
      const args = {
        ...overrunning,
        v1Index: v1({ refName: 'chr1', start: 0, end: 300000 }),
        refName: 'chr1',
        // local [120000,120100] — past `end` (101000), inside the CIGAR's reach
        winCumLo: 120000,
        winCumHi: 120100,
      }
      expect(clipLargeBlockToWindow(args)).toBeUndefined()
      // ...whereas walking the CIGAR finds ops there. This is the divergence.
      const walked = clipSyntenyFeature(
        cig([50000, CIGAR_M]),
        overrunning.start,
        overrunning.mateStart,
        overrunning.mateEnd,
        overrunning.strand,
        120000,
        120100,
      )
      expect(walked?.start).toBe(120000)
      expect(walked?.end).toBe(120100)
    })

    test('right of the window: the gate is safe however long the CIGAR is', () => {
      // `start > winEnd` needs no assumption about the CIGAR at all: the walk
      // begins at `start` and only ever moves forward, so no op it could reach
      // is left of `start`. Same overrunning block, window on the other side.
      const args = {
        ...overrunning,
        v1Index: v1({ refName: 'chr1', start: 0, end: 300000 }),
        refName: 'chr1',
        winCumLo: 1000,
        winCumHi: 1100,
      }
      expect(clipLargeBlockToWindow(args)).toBeUndefined()
      expect(
        clipSyntenyFeature(
          cig([50000, CIGAR_M]),
          overrunning.start,
          overrunning.mateStart,
          overrunning.mateEnd,
          overrunning.strand,
          1000,
          1100,
        ),
      ).toBeUndefined()
    })
  })

  // winStart/winEnd are clamped to the region, which looks like it could
  // collapse them onto one point and make the gate drop everything. It cannot,
  // and the reason is the region selection above it: r0 is only set when the
  // window's cumBp overlap with the region is > 0, so the unclamped window
  // always reaches strictly inside [region.start, region.end] from at least one
  // side, and the floor/ceil widen outward from there. The tightest overlap the
  // selection admits is a sub-bp sliver, which still leaves a 1 bp window.
  test('a sub-bp overlap still yields a usable window, not a collapsed one', () => {
    const c = clipLargeBlockToWindow({
      ...bigBlock,
      v1Index: v1({ refName: 'chr1', start: 0, end: 1000 }),
      refName: 'chr1',
      // overlaps the region by 0.4 bp at its right edge: floor/ceil widen that
      // to local [999,1000] rather than to the empty [1000,1000].
      winCumLo: 999.6,
      winCumHi: 1500,
    })
    expect(c?.start).toBe(999)
    expect(c?.end).toBe(1000)
  })
})

// The window contract: a fractional one makes the block's declared span
// disagree with the span its own CIGAR walks, because the boundary op lengths
// pack through `(cHi - cLo) << 4` (which truncates) while start/end keep the
// fraction. Both callers snap, so this pins WHY rather than a behaviour anyone
// should rely on.
describe('the window must be integer bp', () => {
  // query axis advances on M/=/X and D/N, matching the clip's own convention
  const walkedQuerySpan = (c: Uint32Array) => {
    let q = 0
    for (const packed of c) {
      const op = packed & 0xf
      if (op === CIGAR_M || op === CIGAR_D) {
        q += packed >>> 4
      }
    }
    return q
  }

  const block = cig([100, CIGAR_M], [10, CIGAR_D], [100, CIGAR_M])

  test('an integer window keeps the two in step', () => {
    const r = clipSyntenyFeature(block, 1000, 5000, 5200, 1, 1050, 1150)!
    expect(r.end - r.start).toBe(walkedQuerySpan(r.cigar))
  })

  test('a fractional window does not, and truncates a boundary op to zero', () => {
    const r = clipSyntenyFeature(block, 1000, 5000, 5200, 1, 1000, 1100.6)!
    // the 0.6bp remnant of the D op packs as a zero-length op
    expect([...r.cigar].map(p => p >>> 4)).toContain(0)
    expect(r.end - r.start).toBeGreaterThan(walkedQuerySpan(r.cigar))
  })
})

// A coarse-tier run (CIGAR_RUN pair) maps its mate in proportion: own 100 over
// mate 50, so the window's 20bp slice of it keeps 10bp of mate, entered at
// 80 * 0.5 = 40. The kept D and the trailing match trim as before.
test('a CIGAR_RUN pair is trimmed with its mate length in proportion', () => {
  const c = clipSyntenyFeature(
    cig([100, CIGAR_RUN], [50, CIGAR_RUN], [50, CIGAR_D], [150, CIGAR_M]),
    0,
    0,
    70,
    1,
    80,
    170,
  )
  expect(c).toEqual({
    start: 80,
    end: 170,
    mateStart: 40,
    mateEnd: 70,
    cigar: cig([20, CIGAR_RUN], [10, CIGAR_RUN], [50, CIGAR_D], [20, CIGAR_M]),
  })
})

// The same run on the minus strand: the mate counts down from mateEnd, so the
// slice enters the mate at 50 - 40 = 10 and leaves it at 0.
test('a CIGAR_RUN pair on the minus strand walks the mate down', () => {
  const c = clipSyntenyFeature(
    cig([100, CIGAR_RUN], [50, CIGAR_RUN]),
    0,
    0,
    50,
    -1,
    80,
    100,
  )
  expect(c).toEqual({
    start: 80,
    end: 100,
    mateStart: 0,
    mateEnd: 10,
    cigar: cig([20, CIGAR_RUN], [10, CIGAR_RUN]),
  })
})
