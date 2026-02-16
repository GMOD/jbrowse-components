import { bpToPx } from './executeSyntenyFeaturesAndPositions.ts'
import calculateBlocks from '@jbrowse/core/util/calculateStaticBlocks'

function makeViewSnap(
  regions: { refName: string; start: number; end: number }[],
  bpPerPx = 1,
) {
  return {
    bpPerPx,
    offsetPx: 0,
    displayedRegions: regions.map(r => ({
      assemblyName: 'test',
      ...r,
    })),
    interRegionPaddingWidth: 2,
    minimumBlockWidth: 3,
    width: 800,
    staticBlocks: { contentBlocks: [], blocks: [] },
  } as Parameters<typeof bpToPx>[0]['self']
}

describe('synteny bpToPx', () => {
  it('returns correct offsetPx for first region', () => {
    const self = makeViewSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
    ])
    const result = bpToPx({ self, refName: 'chr1', coord: 500 })
    expect(result).toBeDefined()
    expect(result!.offsetPx).toBe(500)
    expect(result!.paddingPx).toBe(0)
  })

  it('includes padding for non-elided regions before the target', () => {
    const self = makeViewSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const result = bpToPx({ self, refName: 'chr3', coord: 0 })
    expect(result).toBeDefined()
    expect(result!.offsetPx).toBe(2000 + 2 * 2)
    expect(result!.paddingPx).toBe(2 * 2)
  })

  it('does not add padding for elided regions', () => {
    const self = makeViewSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const result = bpToPx({ self, refName: 'chr3', coord: 0 })
    expect(result).toBeDefined()
    expect(result!.offsetPx).toBe(1001 + 2)
    expect(result!.paddingPx).toBe(2)
  })

  it('does not add padding after the last region', () => {
    const self = makeViewSnap([
      { refName: 'chr1', start: 0, end: 1000 },
    ])
    const result = bpToPx({ self, refName: 'chr1', coord: 500 })
    expect(result).toBeDefined()
    expect(result!.paddingPx).toBe(0)
  })

  it('returns undefined for unmatched refName', () => {
    const self = makeViewSnap([
      { refName: 'chr1', start: 0, end: 1000 },
    ])
    const result = bpToPx({ self, refName: 'chrX', coord: 500 })
    expect(result).toBeUndefined()
  })

  it('matches calculateStaticBlocks coordinate space', () => {
    const regions = [
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
      { refName: 'chr3', start: 0, end: 1000 },
      { refName: 'chr4', start: 0, end: 1000 },
      { refName: 'chr5', start: 0, end: 1000 },
    ]
    const self = makeViewSnap(regions)

    const result = bpToPx({ self, refName: 'chr5', coord: 0 })
    expect(result).toBeDefined()

    const blockSet = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: result!.offsetPx,
      displayedRegions: regions.map(r => ({ assemblyName: 'test', ...r })),
      minimumBlockWidth: 3,
      interRegionPaddingWidth: 2,
    })
    const chr5Blocks = blockSet.contentBlocks.filter(
      b => b.refName === 'chr5',
    )
    expect(chr5Blocks.length).toBeGreaterThan(0)
    expect(chr5Blocks[0]!.offsetPx).toBe(result!.offsetPx)
  })

  it('works with many regions (cumulative padding)', () => {
    const regions = Array.from({ length: 20 }, (_, i) => ({
      refName: `chr${i + 1}`,
      start: 0,
      end: 1000,
    }))
    const self = makeViewSnap(regions)

    const result = bpToPx({ self, refName: 'chr20', coord: 0 })
    expect(result).toBeDefined()
    expect(result!.offsetPx).toBe(19 * 1000 + 19 * 2)
    expect(result!.paddingPx).toBe(19 * 2)
  })
})
