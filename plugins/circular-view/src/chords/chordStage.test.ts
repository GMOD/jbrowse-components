import { bpToRadians, calculateStaticSlices } from '../CircularView/slices.ts'
import {
  axisX,
  buildChordAxis,
  chordEndsAt,
  footRadians,
  ribbonAnglesAt,
  ribbonFadeAt,
  sliceKey,
  widenedSpan,
} from './chordStage.ts'

import type { SliceRegion } from '../CircularView/slices.ts'
import type { ChordLanes, ChordStage, RibbonLanes } from './chordStage.ts'

function region(
  refName: string,
  start: number,
  end: number,
  reversed = false,
): SliceRegion {
  return {
    elided: false,
    widthBp: end - start,
    start,
    end,
    refName,
    assemblyName: 'a',
    reversed,
  }
}

const regions: SliceRegion[] = [
  region('chr1', 0, 10000),
  region('chr2', 5000, 15000, true),
  {
    elided: true,
    widthBp: 1000,
    regions: [
      { refName: 'ctgA', start: 0, end: 500, assemblyName: 'a' },
      { refName: 'ctgB', start: 0, end: 500, assemblyName: 'a' },
    ],
  },
  region('chr3', 100, 4100),
]

// the view's own layout: 1000 bp to the radian at a 1000 px radius, and a 20 px
// gap between slices
const radiusPx = 1000
const bpPerRadian = 1000
const spacingPx = 20
const slices = calculateStaticSlices({
  elidedRegions: regions,
  bpPerRadian,
  spacingPx,
  radiusPx,
})
const axis = buildChordAxis(regions)
const stage: ChordStage = {
  radiansPerBp: 1 / bpPerRadian,
  gapRadians: spacingPx / radiusPx,
  offsetRadians: 0,
  radiusPx,
  bezierRadiusPx: 100,
}

function foot(refName: string, bp: number) {
  const slice = axis.byKey.get(sliceKey('a', refName))!
  return footRadians(axisX(slice, bp), slice.index, stage)
}

// The polar stage is the view's slice layout restated as an affine scale, so a
// zoom and a rotation are uniforms: every base has to land where bpToRadians
// puts it, reversed and elided slices included
describe('the unrolled axis', () => {
  test.each([
    ['chr1', 0],
    ['chr1', 2500],
    ['chr1', 10000],
    ['chr2', 5000],
    ['chr2', 12000],
    ['ctgA', 100],
    ['ctgB', 400],
    ['chr3', 100],
    ['chr3', 4000],
  ])('%s:%d lands where the slice layout puts it', (refName, bp) => {
    const slice = slices.find(s =>
      s.region.elided
        ? s.region.regions.some(r => r.refName === refName)
        : s.region.refName === refName,
    )!
    expect(foot(refName, bp)).toBeCloseTo(bpToRadians(slice, bp), 10)
  })

  test('an elided slice answers to every region it swallowed', () => {
    expect(foot('ctgA', 0)).toBe(foot('ctgB', 499))
  })
})

function ribbonLanes(
  ends: [string, number, number, string, number, number, number][],
): RibbonLanes {
  const n = ends.length
  const lanes: RibbonLanes = {
    x1: new Float32Array(n),
    x2: new Float32Array(n),
    y1: new Float32Array(n),
    y2: new Float32Array(n),
    xSlice: new Uint32Array(n),
    ySlice: new Uint32Array(n),
    strand: new Float32Array(n),
    color: new Uint32Array(n),
    count: n,
    features: [],
  }
  ends.forEach(([ref, start, end, mateRef, mateStart, mateEnd, strand], i) => {
    const own = axis.byKey.get(sliceKey('a', ref))!
    const other = axis.byKey.get(sliceKey('a', mateRef))!
    lanes.x1[i] = axisX(own, start)
    lanes.x2[i] = axisX(own, end)
    lanes.y1[i] = axisX(other, mateStart)
    lanes.y2[i] = axisX(other, mateEnd)
    lanes.xSlice[i] = own.index
    lanes.ySlice[i] = other.index
    lanes.strand[i] = strand
  })
  return lanes
}

test('an end spans its own slice, start to end', () => {
  const { a1, a2 } = ribbonAnglesAt(
    ribbonLanes([['chr1', 1000, 3000, 'chr3', 1000, 2000, 1]]),
    0,
    stage,
  )
  expect([a1, a2]).toEqual([foot('chr1', 1000), foot('chr1', 3000)])
})

// a 5kb PAF record on a 250Mb chromosome is 2e-5 of the circle: a zero-width
// quad, invisible and with nothing to point at
test('a sub-pixel end is widened around where it sits', () => {
  const { start, end } = widenedSpan(5, 5.0001, radiusPx)
  expect(end - start).toBeCloseTo(2 / radiusPx)
  expect((start + end) / 2).toBeCloseTo(5.00005)
})

// the elision puts both of an end's bases at one angle, and only the floor
// keeps the ribbon on the figure
test('a ribbon into an elided slice still has width', () => {
  const { m1, m2 } = ribbonAnglesAt(
    ribbonLanes([['chr1', 1000, 3000, 'ctgA', 0, 500, 1]]),
    0,
    stage,
  )
  expect(Math.abs(m1 - m2)).toBeCloseTo(2 / radiusPx)
})

// The strand lives in the order the mate's span is walked and nowhere else: a
// forward alignment pairs the two spans start to start, so its boundary walks
// the mate from its last base back and its two curves do not cross; a reverse
// one pairs the span's start with the mate's end and takes the twist.
describe('the strand', () => {
  const lanes = ribbonLanes([
    ['chr1', 1000, 3000, 'chr3', 1000, 2000, 1],
    ['chr1', 1000, 3000, 'chr3', 1000, 2000, -1],
  ])
  const fwd = ribbonAnglesAt(lanes, 0, stage)
  const rev = ribbonAnglesAt(lanes, 1, stage)

  test('a forward alignment walks the mate high to low', () => {
    expect(fwd.m1).toBeGreaterThan(fwd.m2)
  })

  test('a reverse alignment twists, walking the mate low to high', () => {
    expect(rev.m1).toBeLessThan(rev.m2)
  })

  test('both strands cover the same two spans', () => {
    expect([fwd.a1, fwd.a2]).toEqual([rev.a1, rev.a2])
    expect([fwd.m1, fwd.m2].sort()).toEqual([rev.m1, rev.m2].sort())
  })
})

// A mirrored slice runs the other way round the circle, so its span's first
// base is at the LARGER angle. A forward alignment into one visits its four
// angles in one direction, so its curves do not cross and a band of such
// ribbons reads as a band; sorted angles would give every one a twist it has
// not got.
describe('a mirrored mate slice', () => {
  const lanes = ribbonLanes([
    ['chr1', 1000, 3000, 'chr2', 7000, 10000, 1],
    ['chr1', 1000, 3000, 'chr2', 7000, 10000, -1],
  ])

  test("keeps the mate's genomic order", () => {
    const { m1, m2 } = ribbonAnglesAt(lanes, 1, stage)
    expect(m1).toBeGreaterThan(m2)
  })

  test('leaves a forward alignment untwisted', () => {
    const { a1, a2, m1, m2 } = ribbonAnglesAt(lanes, 0, stage)
    const angles = [a1, a2, m1, m2]
    expect(angles).toEqual([...angles].sort((x, y) => x - y))
  })
})

test('the rotation turns every angle by the same amount', () => {
  const lanes = ribbonLanes([['chr1', 1000, 3000, 'chr3', 1000, 2000, 1]])
  const still = ribbonAnglesAt(lanes, 0, stage)
  const turned = ribbonAnglesAt(lanes, 0, { ...stage, offsetRadians: 0.5 })
  expect(turned.a1 - still.a1).toBeCloseTo(0.5)
  expect(turned.m2 - still.m2).toBeCloseTo(0.5)
})

describe('a chord', () => {
  function chordLanes(ends: [string, number, string, number][]): ChordLanes {
    const n = ends.length
    const lanes: ChordLanes = {
      x: new Float32Array(n),
      x2: new Float32Array(n),
      xSlice: new Uint32Array(n),
      x2Slice: new Uint32Array(n),
      color: new Uint32Array(n),
      count: n,
      features: [],
    }
    ends.forEach(([ref, bp, mateRef, mateBp], i) => {
      const own = axis.byKey.get(sliceKey('a', ref))!
      const other = axis.byKey.get(sliceKey('a', mateRef))!
      lanes.x[i] = axisX(own, bp)
      lanes.x2[i] = axisX(other, mateBp)
      lanes.xSlice[i] = own.index
      lanes.x2Slice[i] = other.index
    })
    return lanes
  }

  // a pixel at this radius is a thousandth of a radian, one base here
  test('whose ends share a pixel draws nothing', () => {
    expect(
      chordEndsAt(chordLanes([['chr1', 1000, 'chr1', 1000.5]]), 0, stage),
    ).toBeUndefined()
  })

  test('across the circle joins its two ends', () => {
    const ends = chordEndsAt(
      chordLanes([['chr1', 1000, 'chr3', 1000]]),
      0,
      stage,
    )
    expect(ends).toEqual({
      startRadians: foot('chr1', 1000),
      endRadians: foot('chr3', 1000),
    })
  })
})

// The linear synteny view's density-honest fade: an end drawn at the 2 px floor
// but spanning a fraction of that carries only the ink its true span covers,
// so a pile of sub-pixel alignments reads as their density, not a solid band
describe('the thin fade', () => {
  const lanes = ribbonLanes([
    ['chr1', 1000, 1000.1, 'chr3', 1000, 1000.1, 1],
    ['chr1', 1000, 1001, 'chr3', 1000, 1001, 1],
    ['chr1', 1000, 3000, 'chr3', 1000, 2000, 1],
  ])

  test('floors a ribbon whose ends are a sliver of a pixel', () => {
    expect(ribbonFadeAt(lanes, 0, stage, 0.15)).toBe(0.15)
  })

  test('keeps the share of the drawn width a sub-pixel ribbon covers', () => {
    // each end spans one base, a pixel at this radius, drawn at two
    expect(ribbonFadeAt(lanes, 1, stage, 0.15)).toBeCloseTo(0.5, 5)
  })

  test('leaves a ribbon wider than the floor alone', () => {
    expect(ribbonFadeAt(lanes, 2, stage, 0.15)).toBe(1)
  })

  test('fades nothing at a floor of one', () => {
    expect(ribbonFadeAt(lanes, 0, stage, 1)).toBe(1)
  })
})
