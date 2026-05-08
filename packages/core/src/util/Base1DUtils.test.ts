import { bpToPx, computeMoveToLayout, moveTo, pxToBp } from './Base1DUtils.ts'
import calculateDynamicBlocks from './calculateDynamicBlocks.ts'
import calculateBlocks from './calculateStaticBlocks.ts'

function makeSnap(
  regions: {
    refName: string
    start: number
    end: number
    reversed?: boolean
  }[],
  opts: { bpPerPx?: number; offsetPx?: number } = {},
) {
  const bpPerPx = opts.bpPerPx ?? 1
  const offsetPx = opts.offsetPx ?? 0
  const displayedRegions = regions.map(r => ({
    assemblyName: 'test',
    ...r,
  }))
  const staticBlocks = calculateBlocks({
    bpPerPx,
    width: 800,
    offsetPx,
    displayedRegions,
    minimumBlockWidth: 3,
    interRegionPaddingWidth: 2,
  })
  return {
    bpPerPx,
    offsetPx,
    displayedRegions,
    minimumBlockWidth: 3,
    interRegionPaddingWidth: 2,
    width: 800,
    staticBlocks,
  }
}

describe('bpToPx', () => {
  it('returns correct offsetPx for single region', () => {
    const self = makeSnap([{ refName: 'chr1', start: 0, end: 1000 }])
    const result = bpToPx({ self, refName: 'chr1', coord: 500 })
    expect(result).toBeDefined()
    expect(result!.offsetPx).toBe(500)
  })

  it('includes padding between non-elided regions', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const result = bpToPx({ self, refName: 'chr3', coord: 0 })
    expect(result).toBeDefined()
    expect(result!.offsetPx).toBe(2004)
  })

  it('does not include padding for elided regions', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const result = bpToPx({ self, refName: 'chr3', coord: 0 })
    expect(result).toBeDefined()
    expect(result!.offsetPx).toBe(1003)
  })

  it('gives consistent results regardless of scroll position', () => {
    const regions = [
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
      { refName: 'chr3', start: 0, end: 1000 },
    ]

    const atStart = makeSnap(regions, { offsetPx: 0 })
    const scrolled = makeSnap(regions, { offsetPx: 2004 })

    const r1 = bpToPx({ self: atStart, refName: 'chr3', coord: 500 })
    const r2 = bpToPx({ self: scrolled, refName: 'chr3', coord: 500 })
    expect(r1).toBeDefined()
    expect(r2).toBeDefined()
    expect(r1!.offsetPx).toBe(r2!.offsetPx)
  })

  it('matches calculateStaticBlocks block positions', () => {
    const regions = [
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
      { refName: 'chr3', start: 0, end: 1000 },
      { refName: 'chr4', start: 0, end: 1000 },
      { refName: 'chr5', start: 0, end: 1000 },
    ]

    const self = makeSnap(regions, { offsetPx: 4008 })
    const result = bpToPx({ self, refName: 'chr5', coord: 0 })
    expect(result).toBeDefined()

    const chr5Blocks = self.staticBlocks.contentBlocks.filter(
      b => b.refName === 'chr5',
    )
    expect(chr5Blocks.length).toBeGreaterThan(0)
    expect(result!.offsetPx).toBe(chr5Blocks[0]!.offsetPx)
  })
})

describe('pxToBp', () => {
  it('returns correct coordinate for single region', () => {
    const self = makeSnap([{ refName: 'chr1', start: 0, end: 1000 }])
    const result = pxToBp(self, 500)
    expect(result.oob).toBe(false)
    expect(result.refName).toBe('chr1')
    expect(result.offset).toBe(500)
  })

  it('accounts for inter-region padding', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const result = pxToBp(self, 2004)
    expect(result.oob).toBe(false)
    expect(result.refName).toBe('chr3')
    expect(result.offset).toBe(0)
  })

  it('returns padding region as next region start', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
    ])
    const result = pxToBp(self, 1001)
    expect(result.oob).toBe(false)
    expect(result.refName).toBe('chr2')
    expect(result.offset).toBe(0)
  })

  it('skips padding for elided regions', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const atChr3Start = pxToBp(self, 1003)
    expect(atChr3Start.oob).toBe(false)
    expect(atChr3Start.refName).toBe('chr3')
    expect(atChr3Start.offset).toBe(0)
  })

  it('is inverse of bpToPx', () => {
    const regions = [
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
      { refName: 'chr3', start: 0, end: 1000 },
    ]
    const self = makeSnap(regions)

    const bp2px = bpToPx({ self, refName: 'chr3', coord: 500 })
    expect(bp2px).toBeDefined()

    const px2bp = pxToBp(self, bp2px!.offsetPx)
    expect(px2bp.refName).toBe('chr3')
    expect(px2bp.offset).toBe(500)
  })

  it('handles oob before first region', () => {
    const self = makeSnap([{ refName: 'chr1', start: 0, end: 1000 }])
    const result = pxToBp(self, -100)
    expect(result.oob).toBe(true)
    expect(result.refName).toBe('chr1')
  })

  it('handles oob after last region', () => {
    const self = makeSnap([{ refName: 'chr1', start: 0, end: 1000 }])
    const result = pxToBp(self, 1500)
    expect(result.oob).toBe(true)
    expect(result.refName).toBe('chr1')
  })
})

describe('reversed region handling', () => {
  it('bpToPx places coord at correct pixel for reversed region', () => {
    const self = makeSnap([
      { refName: 'ctgA', start: 0, end: 1000, reversed: true },
    ])
    // reversed: bpSoFar = r.end - coord = 1000 - 500 = 500 → offsetPx = 500
    const result = bpToPx({ self, refName: 'ctgA', coord: 500 })
    expect(result).toBeDefined()
    expect(result!.offsetPx).toBe(500)
  })

  it('pxToBp returns correct offset for reversed region', () => {
    const self = makeSnap([
      { refName: 'ctgA', start: 0, end: 1000, reversed: true },
    ])
    const result = pxToBp(self, 300)
    expect(result.oob).toBe(false)
    expect(result.refName).toBe('ctgA')
    expect(result.reversed).toBe(true)
    expect(result.offset).toBe(300)
  })

  it('bpToPx and pxToBp round-trip for reversed region', () => {
    const self = makeSnap([
      { refName: 'ctgA', start: 0, end: 1000, reversed: true },
    ])
    const bp2px = bpToPx({ self, refName: 'ctgA', coord: 300 })
    expect(bp2px).toBeDefined()
    const px2bp = pxToBp(self, bp2px!.offsetPx)
    expect(px2bp.refName).toBe('ctgA')
    // offset = r.end - coord = 1000 - 300 = 700
    expect(px2bp.offset).toBe(700)
  })

  it('bpToPx gives symmetric results for reversed vs forward at same bp distance', () => {
    const forward = makeSnap([{ refName: 'ctgA', start: 0, end: 1000 }])
    const reversed = makeSnap([
      { refName: 'ctgA', start: 0, end: 1000, reversed: true },
    ])
    // coord 200 is 200bp from start in forward, 800bp from start (200bp from end) in reversed
    const fwdPx = bpToPx({ self: forward, refName: 'ctgA', coord: 200 })
    const revPx = bpToPx({ self: reversed, refName: 'ctgA', coord: 800 })
    expect(fwdPx!.offsetPx).toBe(revPx!.offsetPx)
  })
})

describe('elided region handling', () => {
  it('bpToPx skips padding after elided region', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const r1 = bpToPx({ self, refName: 'chr1', coord: 1000 })
    const r2 = bpToPx({ self, refName: 'chr2', coord: 0 })
    const r3 = bpToPx({ self, refName: 'chr3', coord: 0 })

    expect(r1!.offsetPx).toBe(1000)
    expect(r2!.offsetPx).toBe(1002)
    expect(r3!.offsetPx).toBe(1003)
  })

  it('pxToBp skips padding after elided region', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const atChr2 = pxToBp(self, 1002)
    expect(atChr2.refName).toBe('chr2')
    expect(atChr2.offset).toBeCloseTo(0, 5)

    const atChr3 = pxToBp(self, 1003)
    expect(atChr3.refName).toBe('chr3')
    expect(atChr3.offset).toBeCloseTo(0, 5)
  })

  it('bpToPx and pxToBp round-trip through elided regions', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1 },
      { refName: 'chr3', start: 0, end: 2 },
      { refName: 'chr4', start: 0, end: 1 },
      { refName: 'chr5', start: 0, end: 1000 },
    ])

    const bp2px = bpToPx({ self, refName: 'chr5', coord: 500 })
    expect(bp2px).toBeDefined()

    const px2bp = pxToBp(self, bp2px!.offsetPx)
    expect(px2bp.refName).toBe('chr5')
    expect(px2bp.offset).toBe(500)
  })

  it('consecutive elided regions accumulate width without padding', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1 },
      { refName: 'chr3', start: 0, end: 2 },
      { refName: 'chr4', start: 0, end: 1 },
      { refName: 'chr5', start: 0, end: 1000 },
    ])

    const r5 = bpToPx({ self, refName: 'chr5', coord: 0 })
    expect(r5!.offsetPx).toBe(1006)
  })

  it('elided region at start does not get padding', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1 },
      { refName: 'chr2', start: 0, end: 1000 },
    ])

    const r2 = bpToPx({ self, refName: 'chr2', coord: 0 })
    expect(r2!.offsetPx).toBe(1)

    const px2bp = pxToBp(self, 1)
    expect(px2bp.refName).toBe('chr2')
    expect(px2bp.offset).toBeCloseTo(0, 5)
  })

  it('all regions elided returns correct bpToPx', () => {
    const self = makeSnap([
      { refName: 'chr1', start: 0, end: 1 },
      { refName: 'chr2', start: 0, end: 2 },
      { refName: 'chr3', start: 0, end: 1 },
    ])

    const r1 = bpToPx({ self, refName: 'chr1', coord: 0 })
    const r2 = bpToPx({ self, refName: 'chr2', coord: 0 })
    const r3 = bpToPx({ self, refName: 'chr3', coord: 0 })

    expect(r1!.offsetPx).toBe(0)
    expect(r2!.offsetPx).toBe(1)
    expect(r3!.offsetPx).toBe(3)
  })
})

describe('computeMoveToLayout', () => {
  const region = (refName: string, len: number) => ({
    assemblyName: 'test',
    refName,
    start: 0,
    end: len,
  })

  function makeLayout(regions: ReturnType<typeof region>[]) {
    return {
      displayedRegions: regions,
      bpPerPx: 1,
      width: 800,
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
      offsetPx: 0,
    }
  }

  it('zooms to fit a sub-region of a single chromosome', () => {
    const snap = makeLayout([region('chr1', 10_000)])
    // select bp 1000–3000 (2000bp) on a 800px view
    const { bpPerPx, offsetPx } = computeMoveToLayout(
      snap,
      { index: 0, offset: 1000 },
      { index: 0, offset: 3000 },
    )
    expect(bpPerPx).toBeCloseTo(2000 / 800)
    // 1000bp in at newBpPerPx
    expect(offsetPx).toBe(Math.round(1000 / bpPerPx))
  })

  it('produces content blocks covering the selected region', () => {
    const snap = makeLayout([region('chr1', 10_000)])
    const { bpPerPx, offsetPx } = computeMoveToLayout(
      snap,
      { index: 0, offset: 500 },
      { index: 0, offset: 2500 },
    )
    const blocks = calculateDynamicBlocks({ ...snap, bpPerPx, offsetPx })
    const content = blocks.contentBlocks
    expect(content.length).toBe(1)
    expect(content[0]!.start).toBeCloseTo(500, 0)
    expect(content[0]!.end).toBeCloseTo(2500, 0)
  })

  it('spans multiple chromosomes and includes inter-region padding', () => {
    const snap = makeLayout([region('chr1', 1000), region('chr2', 1000)])
    // select all of chr1 (index 0, offset 0) to all of chr2 (index 1, offset 1000)
    const { bpPerPx, offsetPx } = computeMoveToLayout(
      snap,
      { index: 0, offset: 0 },
      { index: 1, offset: 1000 },
    )
    // 2000bp total across 800 - 2 padding = 798px
    expect(bpPerPx).toBeCloseTo(2000 / 798)
    const blocks = calculateDynamicBlocks({ ...snap, bpPerPx, offsetPx })
    const content = blocks.contentBlocks
    expect(content.length).toBe(2)
    expect(content[0]!.refName).toBe('chr1')
    expect(content[1]!.refName).toBe('chr2')
  })

  it('start at chr2 leaves chr1 out of content blocks', () => {
    const snap = makeLayout([region('chr1', 1000), region('chr2', 1000)])
    const { bpPerPx, offsetPx } = computeMoveToLayout(
      snap,
      { index: 1, offset: 0 },
      { index: 1, offset: 500 },
    )
    const blocks = calculateDynamicBlocks({ ...snap, bpPerPx, offsetPx })
    const refs = blocks.contentBlocks.map(b => b.refName)
    expect(refs).not.toContain('chr1')
    expect(refs).toContain('chr2')
  })
})

describe('moveTo with clamped bpPerPx (extraBp path)', () => {
  // Simulate a view where zoomTo clamps bpPerPx to a max value, forcing moveTo
  // to center the selection with extraBp rather than fitting it precisely.
  it('centers the selection when zoomTo cannot zoom in far enough', () => {
    const displayedRegions = [
      { assemblyName: 'test', refName: 'chr1', start: 0, end: 10_000 },
    ]
    const minBpPerPx = 5 // floor: can't zoom in past 5bp/px

    let currentBpPerPx = 1
    let currentOffsetPx = 0

    const fakeView = {
      displayedRegions,
      bpPerPx: currentBpPerPx,
      width: 800,
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
      zoomTo(bp: number) {
        currentBpPerPx = Math.max(bp, minBpPerPx)
        return currentBpPerPx
      },
      scrollTo(px: number) {
        currentOffsetPx = px
      },
    }

    // Select a 100bp window; unclamped that needs 100/800 = 0.125 bp/px,
    // but floor is 5bp/px so extraBp kicks in to center it.
    moveTo(fakeView, { index: 0, offset: 4000 }, { index: 0, offset: 4100 })

    expect(currentBpPerPx).toBe(minBpPerPx)
    // At 5bp/px the view covers 800*5=4000bp. The 100bp selection should be
    // centered, so scrollPos ≈ start - (4000-100)/2 / 5
    const viewBp = 800 * minBpPerPx
    const expectedCenter = 4050 // midpoint of 4000..4100
    const expectedOffsetPx = Math.round(
      (expectedCenter - viewBp / 2) / minBpPerPx,
    )
    expect(currentOffsetPx).toBe(expectedOffsetPx)
  })
})
