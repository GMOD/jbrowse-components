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
    const r0Expected = bpToPx({
      self,
      refName: 'chr1',
      coord: 500,
      regionNumber: 0,
    })
    expect(r0).toEqual(r0Expected)

    const r1 = bpToPxFromIndex(idx, 'chr1', 2500, 1)
    const r1Expected = bpToPx({
      self,
      refName: 'chr1',
      coord: 2500,
      regionNumber: 1,
    })
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

describe('viewport culling', () => {
  function makeViewSnapWithOffset(
    regions: { refName: string; start: number; end: number }[],
    offsetPx: number,
    bpPerPx = 1,
  ) {
    return {
      bpPerPx,
      offsetPx,
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

  it('culls features entirely left of both viewports', () => {
    // View 1 viewport: [1000, 1800] (offsetPx=1000, width=800)
    // View 2 viewport: [1000, 1800]
    // Feature at chr1:100-200 → pixels ~100-200 → entirely left of both
    const v1 = makeViewSnapWithOffset(
      [{ refName: 'chr1', start: 0, end: 5000 }],
      1000,
    )
    const v2 = makeViewSnapWithOffset(
      [{ refName: 'chr1', start: 0, end: 5000 }],
      1000,
    )
    const v1Idx = buildBpToPxIndex(v1)
    const v2Idx = buildBpToPxIndex(v2)

    const p11 = bpToPxFromIndex(v1Idx, 'chr1', 100)!
    const p12 = bpToPxFromIndex(v1Idx, 'chr1', 200)!
    const p21 = bpToPxFromIndex(v2Idx, 'chr1', 100)!
    const p22 = bpToPxFromIndex(v2Idx, 'chr1', 200)!

    const viewWidth = 800
    const bufferPx = viewWidth * 0.5

    const topMinX = Math.min(p11.offsetPx, p12.offsetPx) - v1.offsetPx
    const topMaxX = Math.max(p11.offsetPx, p12.offsetPx) - v1.offsetPx
    const botMinX = Math.min(p21.offsetPx, p22.offsetPx) - v2.offsetPx
    const botMaxX = Math.max(p21.offsetPx, p22.offsetPx) - v2.offsetPx

    const topOffScreen = topMaxX < -bufferPx || topMinX > viewWidth + bufferPx
    const botOffScreen = botMaxX < -bufferPx || botMinX > viewWidth + bufferPx

    expect(topOffScreen).toBe(true)
    expect(botOffScreen).toBe(true)
  })

  it('keeps features visible in view 1 even if off-screen in view 2', () => {
    // View 1 viewport: [0, 800] — feature at pixels 400-600 is visible
    // View 2 viewport: [5000, 5800] — feature at pixels 400-600 is off-screen
    const v1 = makeViewSnapWithOffset(
      [{ refName: 'chr1', start: 0, end: 10000 }],
      0,
    )
    const v2 = makeViewSnapWithOffset(
      [{ refName: 'chr1', start: 0, end: 10000 }],
      5000,
    )
    const v1Idx = buildBpToPxIndex(v1)
    const v2Idx = buildBpToPxIndex(v2)

    const p11 = bpToPxFromIndex(v1Idx, 'chr1', 400)!
    const p12 = bpToPxFromIndex(v1Idx, 'chr1', 600)!
    const p21 = bpToPxFromIndex(v2Idx, 'chr1', 400)!
    const p22 = bpToPxFromIndex(v2Idx, 'chr1', 600)!

    const viewWidth = 800
    const bufferPx = viewWidth * 0.5

    const topMinX = Math.min(p11.offsetPx, p12.offsetPx) - v1.offsetPx
    const topMaxX = Math.max(p11.offsetPx, p12.offsetPx) - v1.offsetPx
    const botMinX = Math.min(p21.offsetPx, p22.offsetPx) - v2.offsetPx
    const botMaxX = Math.max(p21.offsetPx, p22.offsetPx) - v2.offsetPx

    const topOffScreen = topMaxX < -bufferPx || topMinX > viewWidth + bufferPx
    const botOffScreen = botMaxX < -bufferPx || botMinX > viewWidth + bufferPx

    expect(topOffScreen).toBe(false)
    expect(botOffScreen).toBe(true)
    // Feature is NOT culled because top edge is visible
    expect(topOffScreen && botOffScreen).toBe(false)
  })

  it('keeps features visible in both viewports', () => {
    const v1 = makeViewSnapWithOffset(
      [{ refName: 'chr1', start: 0, end: 5000 }],
      0,
    )
    const v2 = makeViewSnapWithOffset(
      [{ refName: 'chr1', start: 0, end: 5000 }],
      0,
    )
    const v1Idx = buildBpToPxIndex(v1)
    const v2Idx = buildBpToPxIndex(v2)

    const p11 = bpToPxFromIndex(v1Idx, 'chr1', 400)!
    const p12 = bpToPxFromIndex(v1Idx, 'chr1', 600)!
    const p21 = bpToPxFromIndex(v2Idx, 'chr1', 400)!
    const p22 = bpToPxFromIndex(v2Idx, 'chr1', 600)!

    const viewWidth = 800
    const bufferPx = viewWidth * 0.5

    const topMinX = Math.min(p11.offsetPx, p12.offsetPx) - v1.offsetPx
    const topMaxX = Math.max(p11.offsetPx, p12.offsetPx) - v1.offsetPx
    const botMinX = Math.min(p21.offsetPx, p22.offsetPx) - v2.offsetPx
    const botMaxX = Math.max(p21.offsetPx, p22.offsetPx) - v2.offsetPx

    const topOffScreen = topMaxX < -bufferPx || topMinX > viewWidth + bufferPx
    const botOffScreen = botMaxX < -bufferPx || botMinX > viewWidth + bufferPx

    expect(topOffScreen).toBe(false)
    expect(botOffScreen).toBe(false)
    expect(topOffScreen && botOffScreen).toBe(false)
  })

  it('culls features entirely right of both viewports', () => {
    // Both viewports at [0, 800], feature at pixels 2000-3000
    const v1 = makeViewSnapWithOffset(
      [{ refName: 'chr1', start: 0, end: 5000 }],
      0,
    )
    const v2 = makeViewSnapWithOffset(
      [{ refName: 'chr1', start: 0, end: 5000 }],
      0,
    )
    const v1Idx = buildBpToPxIndex(v1)
    const v2Idx = buildBpToPxIndex(v2)

    const p11 = bpToPxFromIndex(v1Idx, 'chr1', 2000)!
    const p12 = bpToPxFromIndex(v1Idx, 'chr1', 3000)!
    const p21 = bpToPxFromIndex(v2Idx, 'chr1', 2000)!
    const p22 = bpToPxFromIndex(v2Idx, 'chr1', 3000)!

    const viewWidth = 800
    const bufferPx = viewWidth * 0.5

    const topMinX = Math.min(p11.offsetPx, p12.offsetPx) - v1.offsetPx
    const topMaxX = Math.max(p11.offsetPx, p12.offsetPx) - v1.offsetPx
    const botMinX = Math.min(p21.offsetPx, p22.offsetPx) - v2.offsetPx
    const botMaxX = Math.max(p21.offsetPx, p22.offsetPx) - v2.offsetPx

    const topOffScreen = topMaxX < -bufferPx || topMinX > viewWidth + bufferPx
    const botOffScreen = botMaxX < -bufferPx || botMinX > viewWidth + bufferPx

    expect(topOffScreen).toBe(true)
    expect(botOffScreen).toBe(true)
  })

  it('keeps diagonal features (on-screen in one view, off-screen in other)', () => {
    // View 1 at [0, 800]: feature at 400-600 → on-screen
    // View 2 at [5000, 5800]: feature at 400-600 → off-screen
    // Diagonal feature should NOT be culled (visible in view 1)
    const v1 = makeViewSnapWithOffset(
      [{ refName: 'chr1', start: 0, end: 10000 }],
      0,
    )
    const v2 = makeViewSnapWithOffset(
      [{ refName: 'chr1', start: 0, end: 10000 }],
      5000,
    )
    const viewWidth = 800
    const bufferPx = viewWidth * 0.5

    const v1Idx = buildBpToPxIndex(v1)
    const v2Idx = buildBpToPxIndex(v2)

    const topMinX =
      Math.min(
        bpToPxFromIndex(v1Idx, 'chr1', 400)!.offsetPx,
        bpToPxFromIndex(v1Idx, 'chr1', 600)!.offsetPx,
      ) - v1.offsetPx
    const topMaxX =
      Math.max(
        bpToPxFromIndex(v1Idx, 'chr1', 400)!.offsetPx,
        bpToPxFromIndex(v1Idx, 'chr1', 600)!.offsetPx,
      ) - v1.offsetPx
    const botMinX =
      Math.min(
        bpToPxFromIndex(v2Idx, 'chr1', 400)!.offsetPx,
        bpToPxFromIndex(v2Idx, 'chr1', 600)!.offsetPx,
      ) - v2.offsetPx
    const botMaxX =
      Math.max(
        bpToPxFromIndex(v2Idx, 'chr1', 400)!.offsetPx,
        bpToPxFromIndex(v2Idx, 'chr1', 600)!.offsetPx,
      ) - v2.offsetPx

    const topOffScreen = topMaxX < -bufferPx || topMinX > viewWidth + bufferPx
    const botOffScreen = botMaxX < -bufferPx || botMinX > viewWidth + bufferPx

    expect(topOffScreen).toBe(false)
    expect(botOffScreen).toBe(true)
    expect(topOffScreen && botOffScreen).toBe(false)
  })

  it('keeps features within the 50% buffer zone', () => {
    // Viewport at [0, 800], buffer = 400px
    // Feature at 900-1000 → just outside viewport but within buffer (< 1200)
    const v1 = makeViewSnapWithOffset(
      [{ refName: 'chr1', start: 0, end: 5000 }],
      0,
    )
    const v2 = makeViewSnapWithOffset(
      [{ refName: 'chr1', start: 0, end: 5000 }],
      0,
    )
    const viewWidth = 800
    const bufferPx = viewWidth * 0.5

    const v1Idx = buildBpToPxIndex(v1)
    const v2Idx = buildBpToPxIndex(v2)

    const topMinX = bpToPxFromIndex(v1Idx, 'chr1', 900)!.offsetPx - v1.offsetPx
    const topMaxX = bpToPxFromIndex(v1Idx, 'chr1', 1000)!.offsetPx - v1.offsetPx
    const botMinX = bpToPxFromIndex(v2Idx, 'chr1', 900)!.offsetPx - v2.offsetPx
    const botMaxX = bpToPxFromIndex(v2Idx, 'chr1', 1000)!.offsetPx - v2.offsetPx

    const topOffScreen = topMaxX < -bufferPx || topMinX > viewWidth + bufferPx
    const botOffScreen = botMaxX < -bufferPx || botMinX > viewWidth + bufferPx

    // Feature at 900-1000 relative to viewport: topMinX=900, topMaxX=1000
    // viewWidth + bufferPx = 1200, so 900 < 1200 → NOT off-screen
    expect(topOffScreen).toBe(false)
    expect(topOffScreen && botOffScreen).toBe(false)
  })

  it('culls features outside the 50% buffer zone', () => {
    // Viewport at [0, 800], buffer = 400px
    // Feature at 1300-1400 → outside buffer (> 1200)
    const v1 = makeViewSnapWithOffset(
      [{ refName: 'chr1', start: 0, end: 5000 }],
      0,
    )
    const v2 = makeViewSnapWithOffset(
      [{ refName: 'chr1', start: 0, end: 5000 }],
      0,
    )
    const viewWidth = 800
    const bufferPx = viewWidth * 0.5

    const v1Idx = buildBpToPxIndex(v1)
    const v2Idx = buildBpToPxIndex(v2)

    const topMinX = bpToPxFromIndex(v1Idx, 'chr1', 1300)!.offsetPx - v1.offsetPx
    const topMaxX = bpToPxFromIndex(v1Idx, 'chr1', 1400)!.offsetPx - v1.offsetPx
    const botMinX = bpToPxFromIndex(v2Idx, 'chr1', 1300)!.offsetPx - v2.offsetPx
    const botMaxX = bpToPxFromIndex(v2Idx, 'chr1', 1400)!.offsetPx - v2.offsetPx

    const topOffScreen = topMaxX < -bufferPx || topMinX > viewWidth + bufferPx
    const botOffScreen = botMaxX < -bufferPx || botMinX > viewWidth + bufferPx

    // Feature at 1300-1400 > 1200 (viewWidth + bufferPx) → off-screen
    expect(topOffScreen).toBe(true)
    expect(botOffScreen).toBe(true)
  })
})

describe('strand swap with reversed regions', () => {
  // The strand swap at lines 248-250 swaps feature start/end for strand=-1,
  // making the parallelogram cross. In a reversed region, bpToPxFromIndex
  // already flips coordinates, so strand=-1 + reversed = two flips that
  // cancel, producing parallel lines. This is biologically correct: if you
  // reverse one genome view, an inversion appears as same-orientation.

  function computePositions(
    strand: number,
    featureStart: number,
    featureEnd: number,
    regionReversed: boolean,
  ) {
    const self = makeViewSnap([
      { refName: 'chr1', start: 0, end: 1000, reversed: regionReversed },
    ])
    const idx = buildBpToPxIndex(self)

    let f1s = featureStart
    let f1e = featureEnd
    if (strand === -1) {
      ;[f1e, f1s] = [f1s, f1e]
    }
    const p11 = bpToPxFromIndex(idx, 'chr1', f1s)
    const p12 = bpToPxFromIndex(idx, 'chr1', f1e)
    return { p11: p11!.offsetPx, p12: p12!.offsetPx }
  }

  it('strand=+1 non-reversed: parallel (p11 < p12)', () => {
    const { p11, p12 } = computePositions(1, 200, 800, false)
    expect(p11).toBeLessThan(p12)
  })

  it('strand=-1 non-reversed: crossed (p11 > p12)', () => {
    const { p11, p12 } = computePositions(-1, 200, 800, false)
    expect(p11).toBeGreaterThan(p12)
  })

  it('strand=+1 reversed: crossed due to region flip (p11 > p12)', () => {
    const { p11, p12 } = computePositions(1, 200, 800, true)
    expect(p11).toBeGreaterThan(p12)
  })

  it('strand=-1 reversed: parallel — two flips cancel (p11 < p12)', () => {
    const { p11, p12 } = computePositions(-1, 200, 800, true)
    expect(p11).toBeLessThan(p12)
  })
})
