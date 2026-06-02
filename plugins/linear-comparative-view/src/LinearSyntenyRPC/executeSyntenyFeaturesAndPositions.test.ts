import calculateBlocks from '@jbrowse/core/util/calculateStaticBlocks'
import { bpToCumBp, buildBpRegionIndex } from '@jbrowse/synteny-core'

const ASM = 'test'

interface TestRegion {
  refName: string
  start: number
  end: number
  reversed?: boolean
}

// One synteny view: its region index plus the derived pixel lookup. `px` is the
// absolute genomic pixel offset of a coordinate (undefined when outside the
// view's displayed regions), `has` is the cheap refName precull check, and
// `offsetPx` is the view's left edge in px.
function makeView(regions: TestRegion[], { bpPerPx = 1, offsetPx = 0 } = {}) {
  const idx = buildBpRegionIndex({
    bpPerPx,
    minimumBlockWidth: 3,
    displayedRegions: regions.map(r => ({ assemblyName: ASM, ...r })),
  })
  return {
    offsetPx,
    has: (refName: string) => idx.entries.has(refName),
    px: (refName: string, coord: number, displayedRegionIndex?: number) => {
      const cumBp = bpToCumBp(idx, refName, coord, displayedRegionIndex)
      return cumBp === undefined ? undefined : cumBp / bpPerPx
    },
  }
}

// A feature edge spanning [coordA, coordB] is off-screen in a view when its
// whole screen span sits beyond the 50%-of-width buffer on either side — the
// same test the worker's per-feature cull applies.
function edgeOffScreen(
  view: ReturnType<typeof makeView>,
  refName: string,
  coordA: number,
  coordB: number,
  viewWidth = 800,
) {
  const a = view.px(refName, coordA)!
  const b = view.px(refName, coordB)!
  const buffer = viewWidth * 0.5
  return (
    Math.max(a, b) - view.offsetPx < -buffer ||
    Math.min(a, b) - view.offsetPx > viewWidth + buffer
  )
}

describe('synteny coordinate → pixel offset (region index)', () => {
  it('returns the correct offset for the first region', () => {
    const v = makeView([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
    ])
    expect(v.px('chr1', 500)).toBe(500)
  })

  it('accumulates bp for non-elided regions before the target', () => {
    const v = makeView([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    expect(v.px('chr3', 0)).toBe(2000)
  })

  it('accumulates bp for small (elided) regions', () => {
    const v = makeView([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    expect(v.px('chr3', 0)).toBe(1001)
  })

  it('returns undefined for an unmatched refName', () => {
    const v = makeView([{ refName: 'chr1', start: 0, end: 1000 }])
    expect(v.px('chrX', 500)).toBeUndefined()
  })

  it('works with many regions', () => {
    const v = makeView(
      Array.from({ length: 20 }, (_, i) => ({
        refName: `chr${i + 1}`,
        start: 0,
        end: 1000,
      })),
    )
    expect(v.px('chr20', 0)).toBe(19 * 1000)
  })

  it('disambiguates duplicate refNames by displayedRegionIndex', () => {
    const v = makeView([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr1', start: 2000, end: 3000 },
    ])
    expect(v.px('chr1', 500, 0)).toBe(500)
    expect(v.px('chr1', 2500, 1)).toBe(1500)
  })

  it('handles non-unit bpPerPx', () => {
    const v = makeView(
      [
        { refName: 'chr1', start: 0, end: 10000 },
        { refName: 'chr2', start: 0, end: 10000 },
      ],
      { bpPerPx: 10 },
    )
    expect(v.px('chr2', 5000)).toBe(1500)
  })

  it('inverts coordinate direction in a reversed region', () => {
    const v = makeView([
      { refName: 'chr1', start: 0, end: 1000, reversed: true },
    ])
    expect(v.px('chr1', 0)).toBe(1000)
    expect(v.px('chr1', 1000)).toBe(0)
    expect(v.px('chr1', 500)).toBe(500)
  })

  it('accumulates preceding regions before a reversed region', () => {
    const v = makeView([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000, reversed: true },
    ])
    expect(v.px('chr2', 0)).toBe(2000)
    expect(v.px('chr2', 1000)).toBe(1000)
  })

  it('matches calculateStaticBlocks coordinate space', () => {
    const regions = [
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
      { refName: 'chr3', start: 0, end: 1000 },
      { refName: 'chr4', start: 0, end: 1000 },
      { refName: 'chr5', start: 0, end: 1000 },
    ]
    const offsetPx = makeView(regions).px('chr5', 0)!
    expect(offsetPx).toBe(4000)

    const blockSet = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx,
      displayedRegions: regions.map(r => ({ assemblyName: ASM, ...r })),
      minimumBlockWidth: 3,
    })
    const chr5Blocks = blockSet.contentBlocks.filter(b => b.refName === 'chr5')
    expect(chr5Blocks.length).toBeGreaterThan(0)
    expect(chr5Blocks[0]!.offsetPx).toBe(offsetPx)
  })
})

describe('viewport culling', () => {
  it('culls features entirely left of both viewports', () => {
    // viewports [1000,1800]; feature chr1:100-200 → px ~100-200, left of both
    const v1 = makeView([{ refName: 'chr1', start: 0, end: 5000 }], {
      offsetPx: 1000,
    })
    const v2 = makeView([{ refName: 'chr1', start: 0, end: 5000 }], {
      offsetPx: 1000,
    })
    expect(edgeOffScreen(v1, 'chr1', 100, 200)).toBe(true)
    expect(edgeOffScreen(v2, 'chr1', 100, 200)).toBe(true)
  })

  it('keeps features visible in view 1 even if off-screen in view 2', () => {
    // view 1 [0,800] shows px 400-600; view 2 [5000,5800] does not
    const v1 = makeView([{ refName: 'chr1', start: 0, end: 10000 }])
    const v2 = makeView([{ refName: 'chr1', start: 0, end: 10000 }], {
      offsetPx: 5000,
    })
    expect(edgeOffScreen(v1, 'chr1', 400, 600)).toBe(false)
    expect(edgeOffScreen(v2, 'chr1', 400, 600)).toBe(true)
  })

  it('keeps features visible in both viewports', () => {
    const v1 = makeView([{ refName: 'chr1', start: 0, end: 5000 }])
    const v2 = makeView([{ refName: 'chr1', start: 0, end: 5000 }])
    expect(edgeOffScreen(v1, 'chr1', 400, 600)).toBe(false)
    expect(edgeOffScreen(v2, 'chr1', 400, 600)).toBe(false)
  })

  it('culls features entirely right of both viewports', () => {
    // both viewports [0,800], feature at px 2000-3000
    const v1 = makeView([{ refName: 'chr1', start: 0, end: 5000 }])
    const v2 = makeView([{ refName: 'chr1', start: 0, end: 5000 }])
    expect(edgeOffScreen(v1, 'chr1', 2000, 3000)).toBe(true)
    expect(edgeOffScreen(v2, 'chr1', 2000, 3000)).toBe(true)
  })

  it('keeps diagonal features (on-screen in one view, off-screen in the other)', () => {
    const v1 = makeView([{ refName: 'chr1', start: 0, end: 10000 }])
    const v2 = makeView([{ refName: 'chr1', start: 0, end: 10000 }], {
      offsetPx: 5000,
    })
    expect(edgeOffScreen(v1, 'chr1', 400, 600)).toBe(false)
    expect(edgeOffScreen(v2, 'chr1', 400, 600)).toBe(true)
  })

  it('keeps features within the 50% buffer zone', () => {
    // viewport [0,800], buffer 400 → cutoff 1200; feature 900-1000 is inside
    const v = makeView([{ refName: 'chr1', start: 0, end: 5000 }])
    expect(edgeOffScreen(v, 'chr1', 900, 1000)).toBe(false)
  })

  it('culls features outside the 50% buffer zone', () => {
    // feature 1300-1400 > 1200 cutoff → off-screen
    const v = makeView([{ refName: 'chr1', start: 0, end: 5000 }])
    expect(edgeOffScreen(v, 'chr1', 1300, 1400)).toBe(true)
  })
})

describe('strand swap with reversed regions', () => {
  // strand=-1 swaps the feature's start/end, making the parallelogram cross. In
  // a reversed region bpToCumBp already flips coordinates, so strand=-1 +
  // reversed are two flips that cancel → parallel. Biologically correct:
  // reverse one genome and an inversion appears same-orientation.
  function positions(
    strand: number,
    start: number,
    end: number,
    reversed: boolean,
  ) {
    const v = makeView([{ refName: 'chr1', start: 0, end: 1000, reversed }])
    const [f1s, f1e] = strand === -1 ? [end, start] : [start, end]
    return { p11: v.px('chr1', f1s)!, p12: v.px('chr1', f1e)! }
  }

  it('strand=+1 non-reversed: parallel (p11 < p12)', () => {
    const { p11, p12 } = positions(1, 200, 800, false)
    expect(p11).toBeLessThan(p12)
  })

  it('strand=-1 non-reversed: crossed (p11 > p12)', () => {
    const { p11, p12 } = positions(-1, 200, 800, false)
    expect(p11).toBeGreaterThan(p12)
  })

  it('strand=+1 reversed: crossed due to region flip (p11 > p12)', () => {
    const { p11, p12 } = positions(1, 200, 800, true)
    expect(p11).toBeGreaterThan(p12)
  })

  it('strand=-1 reversed: parallel — two flips cancel (p11 < p12)', () => {
    const { p11, p12 } = positions(-1, 200, 800, true)
    expect(p11).toBeLessThan(p12)
  })
})

describe('refName precull via index presence', () => {
  // Cheap pre-cull at the head of the per-feature loop in
  // executeSyntenyFeaturesAndPositions: features whose refName isn't in either
  // view's displayed regions are dropped before any pixel math.
  it('short-circuits when refName is absent in v1', () => {
    const v1 = makeView([{ refName: 'chr1', start: 0, end: 1000 }])
    const v2 = makeView([{ refName: 'chr1', start: 0, end: 1000 }])
    expect(v1.has('chrX')).toBe(false)
    expect(v2.has('chr1')).toBe(true)
  })

  it('short-circuits when mate.refName is absent in v2', () => {
    const v1 = makeView([{ refName: 'chr1', start: 0, end: 1000 }])
    const v2 = makeView([{ refName: 'chr2', start: 0, end: 1000 }])
    expect(v1.has('chr1')).toBe(true)
    expect(v2.has('chr1')).toBe(false)
  })

  it('keeps features when both refNames are present', () => {
    const v1 = makeView([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
    ])
    const v2 = makeView([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
    ])
    expect(v1.has('chr1') && v2.has('chr2')).toBe(true)
  })

  it('is a strict subset of the pixel-lookup undefined check', () => {
    // refName present but coord outside any region: precull keeps it, px() still
    // returns undefined, and the downstream cull drops it.
    const v = makeView([{ refName: 'chr1', start: 0, end: 1000 }])
    expect(v.has('chr1')).toBe(true)
    expect(v.px('chr1', 5000)).toBeUndefined()
  })
})
