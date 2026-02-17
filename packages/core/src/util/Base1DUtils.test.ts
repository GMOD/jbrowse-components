import { bpToPx, pxToBp } from './Base1DUtils.ts'
import calculateBlocks from './calculateStaticBlocks.ts'

function makeSnap(
  regions: { refName: string; start: number; end: number }[],
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
    const result = pxToBp(self, 1003)
    expect(result.oob).toBe(false)
    expect(result.refName).toBe('chr3')
    expect(result.offset).toBe(2)
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
