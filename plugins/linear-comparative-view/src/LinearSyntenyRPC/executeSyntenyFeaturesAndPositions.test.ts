import calculateBlocks from '@jbrowse/core/util/calculateStaticBlocks'

import {
  bpToPx,
  buildBpToPxIndex,
  bpToPxFromIndex,
} from './executeSyntenyFeaturesAndPositions.ts'

function makeViewSnap(
  regions: {
    refName: string
    start: number
    end: number
    reversed?: boolean
  }[],
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
    const self = makeViewSnap([{ refName: 'chr1', start: 0, end: 1000 }])
    const result = bpToPx({ self, refName: 'chr1', coord: 500 })
    expect(result).toBeDefined()
    expect(result!.paddingPx).toBe(0)
  })

  it('returns undefined for unmatched refName', () => {
    const self = makeViewSnap([{ refName: 'chr1', start: 0, end: 1000 }])
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
    const chr5Blocks = blockSet.contentBlocks.filter(b => b.refName === 'chr5')
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

describe('bpToPxFromIndex matches bpToPx', () => {
  it('returns correct offsetPx for first region', () => {
    const self = makeViewSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
    ])
    const idx = buildBpToPxIndex(self)
    const result = bpToPxFromIndex(idx, 'chr1', 500)
    const expected = bpToPx({ self, refName: 'chr1', coord: 500 })
    expect(result).toEqual(expected)
  })

  it('includes padding for non-elided regions before the target', () => {
    const self = makeViewSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const idx = buildBpToPxIndex(self)
    const result = bpToPxFromIndex(idx, 'chr3', 0)
    const expected = bpToPx({ self, refName: 'chr3', coord: 0 })
    expect(result).toEqual(expected)
  })

  it('does not add padding for elided regions', () => {
    const self = makeViewSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1 },
      { refName: 'chr3', start: 0, end: 1000 },
    ])
    const idx = buildBpToPxIndex(self)
    const result = bpToPxFromIndex(idx, 'chr3', 0)
    const expected = bpToPx({ self, refName: 'chr3', coord: 0 })
    expect(result).toEqual(expected)
  })

  it('returns undefined for unmatched refName', () => {
    const self = makeViewSnap([{ refName: 'chr1', start: 0, end: 1000 }])
    const idx = buildBpToPxIndex(self)
    expect(bpToPxFromIndex(idx, 'chrX', 500)).toBeUndefined()
  })

  it('works with many regions (cumulative padding)', () => {
    const regions = Array.from({ length: 20 }, (_, i) => ({
      refName: `chr${i + 1}`,
      start: 0,
      end: 1000,
    }))
    const self = makeViewSnap(regions)
    const idx = buildBpToPxIndex(self)
    const result = bpToPxFromIndex(idx, 'chr20', 0)
    const expected = bpToPx({ self, refName: 'chr20', coord: 0 })
    expect(result).toEqual(expected)
  })

  it('handles duplicate refNames with regionNumber disambiguation', () => {
    const self = makeViewSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr1', start: 2000, end: 3000 },
    ])
    const idx = buildBpToPxIndex(self)

    const r0 = bpToPxFromIndex(idx, 'chr1', 500, 0)
    const r0Expected = bpToPx({ self, refName: 'chr1', coord: 500, regionNumber: 0 })
    expect(r0).toEqual(r0Expected)

    const r1 = bpToPxFromIndex(idx, 'chr1', 2500, 1)
    const r1Expected = bpToPx({ self, refName: 'chr1', coord: 2500, regionNumber: 1 })
    expect(r1).toEqual(r1Expected)
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
    const idx = buildBpToPxIndex(self)

    const result = bpToPxFromIndex(idx, 'chr5', 0)
    const expected = bpToPx({ self, refName: 'chr5', coord: 0 })
    expect(result).toEqual(expected)

    const blockSet = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: result!.offsetPx,
      displayedRegions: regions.map(r => ({ assemblyName: 'test', ...r })),
      minimumBlockWidth: 3,
      interRegionPaddingWidth: 2,
    })
    const chr5Blocks = blockSet.contentBlocks.filter(b => b.refName === 'chr5')
    expect(chr5Blocks.length).toBeGreaterThan(0)
    expect(chr5Blocks[0]!.offsetPx).toBe(result!.offsetPx)
  })

  it('handles non-unit bpPerPx', () => {
    const self = makeViewSnap(
      [
        { refName: 'chr1', start: 0, end: 10000 },
        { refName: 'chr2', start: 0, end: 10000 },
      ],
      10,
    )
    const idx = buildBpToPxIndex(self)
    const result = bpToPxFromIndex(idx, 'chr2', 5000)
    const expected = bpToPx({ self, refName: 'chr2', coord: 5000 })
    expect(result).toEqual(expected)
  })

  it('handles reversed region correctly', () => {
    const self = makeViewSnap([
      { refName: 'chr1', start: 0, end: 1000, reversed: true },
    ])
    const idx = buildBpToPxIndex(self)

    const startResult = bpToPxFromIndex(idx, 'chr1', 0)
    const startExpected = bpToPx({ self, refName: 'chr1', coord: 0 })
    expect(startResult).toEqual(startExpected)
    expect(startResult!.offsetPx).toBe(1000)

    const endResult = bpToPxFromIndex(idx, 'chr1', 1000)
    const endExpected = bpToPx({ self, refName: 'chr1', coord: 1000 })
    expect(endResult).toEqual(endExpected)
    expect(endResult!.offsetPx).toBe(0)

    const midResult = bpToPxFromIndex(idx, 'chr1', 500)
    const midExpected = bpToPx({ self, refName: 'chr1', coord: 500 })
    expect(midResult).toEqual(midExpected)
    expect(midResult!.offsetPx).toBe(500)
  })

  it('handles reversed region with preceding regions', () => {
    const self = makeViewSnap([
      { refName: 'chr1', start: 0, end: 1000 },
      { refName: 'chr2', start: 0, end: 1000, reversed: true },
    ])
    const idx = buildBpToPxIndex(self)

    const result = bpToPxFromIndex(idx, 'chr2', 0)
    const expected = bpToPx({ self, refName: 'chr2', coord: 0 })
    expect(result).toEqual(expected)

    const result2 = bpToPxFromIndex(idx, 'chr2', 1000)
    const expected2 = bpToPx({ self, refName: 'chr2', coord: 1000 })
    expect(result2).toEqual(expected2)
  })

  it('reversed region inverts coordinate direction', () => {
    const self = makeViewSnap([
      { refName: 'chr1', start: 0, end: 1000, reversed: true },
    ])
    const idx = buildBpToPxIndex(self)

    const left = bpToPxFromIndex(idx, 'chr1', 200)
    const right = bpToPxFromIndex(idx, 'chr1', 800)
    expect(left!.offsetPx).toBeGreaterThan(right!.offsetPx)
  })
})
