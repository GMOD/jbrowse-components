import { hitCoverageBand } from './coverageBandMarks.ts'
import { coverageBinAt } from './coverageDownsampling.ts'
import { packInstances as packIndicatorInstances } from './indicatorLayout.generated.ts'
import { packInstances as packInterbaseInstances } from './interbaseHistogramLayout.generated.ts'

import type { CoverageBandRegion } from './coverageBandMarks.ts'

// One block [1000, 1100) over 200 px, so 0.5 bp/px and x = (bp - 1000) * 2.
const block = {
  displayedRegionIndex: 0,
  start: 1000,
  end: 1100,
  screenStartPx: 0,
  screenEndPx: 200,
  reversed: false,
}
const xOf = (bp: number) => (bp - 1000) * 2

// coverageHeight=90, YSCALEBAR_LABEL_OFFSET=5 → effectiveH=80 → effectiveH/2=40.
// interbaseMaxCount/domainMax = 20/20 = 1 → interbaseHeight=40. Edges snap to
// whole px through interbaseEdgePx, so a full-height bar spans px [5, 45].
const COV_HEIGHT = 90
const DOMAIN_MAX = 20

function segments(
  s: { position: number; yOffset: number; height: number; colorType: number }[],
) {
  return packInterbaseInstances(
    {
      position: s.map(x => x.position),
      yOffset: s.map(x => x.yOffset),
      segHeight: s.map(x => x.height),
      colorType: s.map(x => x.colorType),
    },
    s.length,
  )
}

function indicators(s: { position: number; colorType: number }[]) {
  return packIndicatorInstances(
    { position: s.map(x => x.position), colorType: s.map(x => x.colorType) },
    s.length,
  )
}

function region(over: Partial<CoverageBandRegion> = {}): CoverageBandRegion {
  return {
    coveragePackedBuffer: new ArrayBuffer(0),
    snpPackedBuffer: new ArrayBuffer(0),
    interbasePackedBuffer: segments([]),
    indicatorPackedBuffer: indicators([]),
    coverageMaxDepth: 0,
    coverageBinSize: 1,
    interbaseMaxCount: 0,
    ...over,
  }
}

const band = (over: Partial<Parameters<typeof hitCoverageBand>[1]> = {}) => ({
  height: COV_HEIGHT,
  top: 0,
  domainMax: DOMAIN_MAX as number | undefined,
  showInterbase: true,
  ...over,
})

const oneBarAt1005 = region({
  interbasePackedBuffer: segments([
    { position: 1005, yOffset: 0, height: 1, colorType: 1 },
  ]),
  interbaseMaxCount: 20,
})

describe('the interbase histogram bars', () => {
  it('hits a bar within its drawn rectangle', () => {
    expect(hitCoverageBand(oneBarAt1005, band(), block, xOf(1005), 30)).toEqual(
      { layer: 'interbase', position: 1005, type: 1 },
    )
  })

  it('misses below the bar bottom, which stays the depth area', () => {
    expect(
      hitCoverageBand(oneBarAt1005, band(), block, xOf(1005), 60),
    ).toBeUndefined()
  })

  it('misses beyond the horizontal slack', () => {
    // 1008 is 6 px from the bar at 1005; the slack is 3
    expect(
      hitCoverageBand(oneBarAt1005, band(), block, xOf(1008), 30),
    ).toBeUndefined()
  })

  it('is off with the interbase toggle', () => {
    expect(
      hitCoverageBand(
        oneBarAt1005,
        band({ showInterbase: false }),
        block,
        xOf(1005),
        30,
      ),
    ).toBeUndefined()
  })

  it('waits for the depth domain the bars are scaled by', () => {
    expect(
      hitCoverageBand(
        oneBarAt1005,
        band({ domainMax: undefined }),
        block,
        xOf(1005),
        30,
      ),
    ).toBeUndefined()
  })

  it('answers nothing in a hidden band', () => {
    expect(
      hitCoverageBand(oneBarAt1005, band({ height: 0 }), block, xOf(1005), 30),
    ).toBeUndefined()
  })

  // A stacked bar: insertion occupies [0, 0.2] of the stack and softclip
  // [0.2, 1.0], i.e. px [5, 13] and [13, 45]. Which type the hover means is
  // which SEGMENT is under the cursor, not which is tallest.
  const stackedAt1005 = region({
    interbasePackedBuffer: segments([
      { position: 1005, yOffset: 0, height: 0.2, colorType: 1 },
      { position: 1005, yOffset: 0.2, height: 0.8, colorType: 2 },
    ]),
    interbaseMaxCount: 20,
  })

  it.each([
    ['the short top segment', 8, 1],
    ['the tall bottom segment', 30, 2],
    ['the slack below the stack, to the bottom-most segment', 46, 2],
  ])('reports the type under the cursor: %s', (_name, yPx, type) => {
    expect(
      hitCoverageBand(stackedAt1005, band(), block, xOf(1005), yPx)?.type,
    ).toBe(type)
  })

  // A bar taller than the band it is drawn in: `interbaseMaxCount` is the
  // fetched block's peak and `domainMax` the visible, bounded domain, so a
  // 300x breakpoint under a bound of 20 scales to 600 px off a 90 px band.
  // Both backends clip it to the band; the hit stops there too, or a 3 px
  // column would answer interbase for every read hover under it.
  const overflowingAt1005 = region({
    interbasePackedBuffer: segments([
      { position: 1005, yOffset: 0, height: 1, colorType: 2 },
    ]),
    interbaseMaxCount: 300,
  })

  it('still hits the overflowing bar inside the band', () => {
    expect(
      hitCoverageBand(overflowingAt1005, band(), block, xOf(1005), 50),
    ).toEqual({ layer: 'interbase', position: 1005, type: 2 })
  })

  it.each([
    ['just past the band bottom', 100],
    ['deep in the pileup', 400],
  ])('misses %s, where nothing is drawn', (_name, yPx) => {
    expect(
      hitCoverageBand(overflowingAt1005, band(), block, xOf(1005), yPx),
    ).toBeUndefined()
  })

  it('measures against a band lower on the canvas', () => {
    const lower = band({ top: 100 })
    expect(
      hitCoverageBand(oneBarAt1005, lower, block, xOf(1005), 130)?.layer,
    ).toBe('interbase')
    expect(
      hitCoverageBand(oneBarAt1005, lower, block, xOf(1005), 30),
    ).toBeUndefined()
  })
})

describe('the indicator triangles', () => {
  const triangleAt1005 = region({
    indicatorPackedBuffer: indicators([{ position: 1005, colorType: 3 }]),
  })

  it('hits a triangle in the top strip', () => {
    expect(
      hitCoverageBand(triangleAt1005, band(), block, xOf(1005), 3),
    ).toEqual({ layer: 'indicator', position: 1005, type: 3 })
  })

  it('draws before the domain resolves, so it is hittable before it too', () => {
    expect(
      hitCoverageBand(
        triangleAt1005,
        band({ domainMax: undefined }),
        block,
        xOf(1005),
        3,
      )?.layer,
    ).toBe('indicator')
  })

  it('is off with the interbase toggle', () => {
    expect(
      hitCoverageBand(
        triangleAt1005,
        band({ showInterbase: false }),
        block,
        xOf(1005),
        3,
      ),
    ).toBeUndefined()
  })

  it('outranks the bar hanging under it', () => {
    const both = region({
      ...triangleAt1005,
      interbasePackedBuffer: oneBarAt1005.interbasePackedBuffer,
      interbaseMaxCount: 20,
    })
    expect(hitCoverageBand(both, band(), block, xOf(1005), 3)?.layer).toBe(
      'indicator',
    )
    expect(hitCoverageBand(both, band(), block, xOf(1005), 30)?.layer).toBe(
      'interbase',
    )
  })
})

describe('the depth bin under the cursor', () => {
  const arrays = (over: {
    depths?: Float32Array
    start?: number
    mismatches?: number[]
    bases?: Uint8Array
  }) => {
    const mismatchPositions = Uint32Array.from(over.mismatches ?? [])
    return {
      coverageDepths: over.depths ?? new Float32Array(100).fill(10),
      coverageStartPos: over.start ?? 1000,
      mismatchPositions,
      mismatchBases:
        over.bases ?? new Uint8Array(mismatchPositions.length).fill(65),
    }
  }

  it('is the base under the cursor at base-level zoom', () => {
    expect(coverageBinAt(arrays({}), 1000, 0.05, false)).toBe(1000)
  })

  it('is undefined off the end of the depth array', () => {
    expect(
      coverageBinAt(
        arrays({ depths: new Float32Array([10]) }),
        1005,
        0.05,
        false,
      ),
    ).toBeUndefined()
  })

  it('snaps to a SNP over 5% of the pixel it covers, zoomed out', () => {
    expect(
      coverageBinAt(arrays({ mismatches: [1003, 1003] }), 1000, 10, false),
    ).toBe(1003)
  })

  it('does not snap to a SNP under 5%', () => {
    expect(
      coverageBinAt(
        arrays({ depths: new Float32Array(100).fill(100), mismatches: [1003] }),
        1000,
        10,
        false,
      ),
    ).toBe(1000)
  })

  // The snap must not name a segment the band declined to colour, and the
  // band hides one allele at a time: four 10% alleles pool to 40% and clear
  // a 30% floor while the band paints nothing there.
  it("honours the band's allele floor, per allele", () => {
    const tenPercent = arrays({ mismatches: [1003] })
    expect(coverageBinAt(tenPercent, 1000, 10, false, 0)).toBe(1003)
    expect(coverageBinAt(tenPercent, 1000, 10, false, 0.2)).toBe(1000)
    const alleles = [65, 67, 71, 84]
    const pooled = arrays({
      depths: new Float32Array(100).fill(100),
      mismatches: new Array(40).fill(1003),
      bases: Uint8Array.from(
        { length: 40 },
        (_, i) => alleles[Math.floor(i / 10)]!,
      ),
    })
    expect(coverageBinAt(pooled, 1000, 10, false, 0.3)).toBe(1000)
    const one = arrays({
      depths: new Float32Array(100).fill(100),
      mismatches: new Array(40).fill(1003),
    })
    expect(coverageBinAt(one, 1000, 10, false, 0.3)).toBe(1003)
  })

  // On a reversed block bp run LEFTWARD, so the pixel holding base 1000 covers
  // (990, 1000], not [1000, 1010).
  it('widens the other way on a reversed block', () => {
    const left = arrays({
      mismatches: [995, 995],
      start: 900,
      depths: new Float32Array(200).fill(10),
    })
    expect(coverageBinAt(left, 1000, 10, true)).toBe(995)
    expect(coverageBinAt(left, 1000, 10, false)).toBe(1000)
    const right = arrays({ mismatches: [1005, 1005] })
    expect(coverageBinAt(right, 1000, 10, true)).toBe(1000)
    expect(coverageBinAt(right, 1000, 10, false)).toBe(1005)
  })
})
