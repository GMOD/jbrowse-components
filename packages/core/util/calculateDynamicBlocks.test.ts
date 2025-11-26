import calculateVisibleRegions from './calculateDynamicBlocks'
import calculateStaticBlocks from './calculateStaticBlocks'

import type { BaseBlock } from './blockTypes'

const ctgA = { assemblyName: 'test', refName: 'ctgA', start: 0, end: 50000 }

test('one', () => {
  expect(
    calculateVisibleRegions({
      offsetPx: 0,
      width: 200,
      displayedRegions: [ctgA],
      bpPerPx: 1,
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    }).getBlocks(),
  ).toMatchSnapshot()
})
test('two', () => {
  expect(
    calculateVisibleRegions({
      offsetPx: 0,
      width: 200,
      displayedRegions: [{ ...ctgA, reversed: true }],
      bpPerPx: 1,
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    }).getBlocks(),
  ).toMatchSnapshot()
})
test('three', () => {
  expect(
    calculateVisibleRegions({
      offsetPx: -100,
      width: 200,
      displayedRegions: [{ ...ctgA, reversed: true }],
      bpPerPx: 1,
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    }).getBlocks(),
  ).toMatchSnapshot()
})
test('four', () => {
  expect(
    calculateVisibleRegions({
      offsetPx: -100,
      width: 350,
      displayedRegions: [ctgA],
      bpPerPx: 1,
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    }).getBlocks(),
  ).toMatchSnapshot()
})
test('five', () => {
  expect(
    calculateVisibleRegions({
      offsetPx: 521,
      width: 927,
      displayedRegions: [{ ...ctgA, reversed: false }],
      bpPerPx: 0.05,
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    }).getBlocks(),
  ).toMatchSnapshot()
})

// ai generated test
describe('dynamic and static blocks have matching offsets for full regions', () => {
  it('when multiple complete regions are offscreen to the left', () => {
    const view = {
      width: 980,
      displayedRegions: [
        { ...ctgA, start: 0, end: 1000 },
        { ...ctgA, start: 2000, end: 3000 },
        { ...ctgA, start: 4000, end: 5000 },
        { ...ctgA, start: 6000, end: 7000 },
        { ...ctgA, start: 8000, end: 9000 },
      ],
      minimumBlockWidth: 3,
      interRegionPaddingWidth: 2,
      offsetPx: 550,
      bpPerPx: 5,
    }
    const dynamicBlocks = calculateVisibleRegions(view).getBlocks()
    const staticBlocks = calculateStaticBlocks(view).getBlocks()

    const dynamicBlock6000 = dynamicBlocks.find(
      b => b.start === 6000 && b.end === 7000 && b.type === 'ContentBlock',
    )
    const staticBlock6000 = staticBlocks.find(
      b => b.start === 6000 && b.end === 7000 && b.type === 'ContentBlock',
    )
    expect(dynamicBlock6000?.offsetPx).toEqual(606)
    expect(staticBlock6000?.offsetPx).toEqual(606)

    const dynamicBlock8000 = dynamicBlocks.find(
      b => b.start === 8000 && b.end === 9000 && b.type === 'ContentBlock',
    )
    const staticBlock8000 = staticBlocks.find(
      b => b.start === 8000 && b.end === 9000 && b.type === 'ContentBlock',
    )
    expect(dynamicBlock8000?.offsetPx).toEqual(808)
    expect(staticBlock8000?.offsetPx).toEqual(808)
  })

  it('when first complete region is offscreen', () => {
    const view = {
      width: 1600,
      displayedRegions: [
        { ...ctgA, start: 0, end: 1000 },
        { ...ctgA, start: 2000, end: 3000 },
        { ...ctgA, start: 4000, end: 5000 },
        { ...ctgA, start: 6000, end: 7000 },
        { ...ctgA, start: 8000, end: 9000 },
      ],
      minimumBlockWidth: 3,
      interRegionPaddingWidth: 2,
      offsetPx: 502,
      bpPerPx: 2,
    }
    const dynamicBlocks = calculateVisibleRegions(view).getBlocks()
    const staticBlocks = calculateStaticBlocks(view).getBlocks()

    const dynamicBlock2000 = dynamicBlocks.find(
      b => b.start === 2000 && b.end === 3000 && b.type === 'ContentBlock',
    )
    const staticBlock2000 = staticBlocks.find(
      b => b.start === 2000 && b.end === 3000 && b.type === 'ContentBlock',
    )
    expect(dynamicBlock2000?.offsetPx).toEqual(502)
    expect(staticBlock2000?.offsetPx).toEqual(502)

    const dynamicBlock4000 = dynamicBlocks.find(
      b => b.start === 4000 && b.end === 5000 && b.type === 'ContentBlock',
    )
    const staticBlock4000 = staticBlocks.find(
      b => b.start === 4000 && b.end === 5000 && b.type === 'ContentBlock',
    )
    expect(dynamicBlock4000?.offsetPx).toEqual(1004)
    expect(staticBlock4000?.offsetPx).toEqual(1004)
  })

  it('with reversed regions and offscreen blocks', () => {
    const view = {
      width: 1600,
      displayedRegions: [
        { ...ctgA, start: 0, end: 1000, reversed: true },
        { ...ctgA, start: 2000, end: 3000, reversed: true },
        { ...ctgA, start: 4000, end: 5000, reversed: true },
      ],
      minimumBlockWidth: 3,
      interRegionPaddingWidth: 2,
      offsetPx: 502,
      bpPerPx: 2,
    }
    const dynamicBlocks = calculateVisibleRegions(view).getBlocks()
    const staticBlocks = calculateStaticBlocks(view).getBlocks()

    const dynamicBlock2000 = dynamicBlocks.find(
      b => b.start === 2000 && b.end === 3000 && b.type === 'ContentBlock',
    )
    const staticBlock2000 = staticBlocks.find(
      b => b.start === 2000 && b.end === 3000 && b.type === 'ContentBlock',
    )
    expect(dynamicBlock2000?.offsetPx).toEqual(502)
    expect(staticBlock2000?.offsetPx).toEqual(502)

    const dynamicBlock4000 = dynamicBlocks.find(
      b => b.start === 4000 && b.end === 5000 && b.type === 'ContentBlock',
    )
    const staticBlock4000 = staticBlocks.find(
      b => b.start === 4000 && b.end === 5000 && b.type === 'ContentBlock',
    )
    expect(dynamicBlock4000?.offsetPx).toEqual(1004)
    expect(staticBlock4000?.offsetPx).toEqual(1004)
  })
})

// ai generated test
describe('dynamic and static blocks match with multiple chromosomes', () => {
  const baseView = {
    width: 1000,
    displayedRegions: [
      { assemblyName: 'hg38', refName: 'chr1', start: 1000, end: 2000 },
      { assemblyName: 'hg38', refName: 'chr2', start: 5000, end: 6000 },
      { assemblyName: 'hg38', refName: 'chr3', start: 10000, end: 11000 },
      { assemblyName: 'hg38', refName: 'chr4', start: 20000, end: 21000 },
      { assemblyName: 'hg38', refName: 'chr5', start: 30000, end: 31000 },
    ],
    minimumBlockWidth: 3,
    interRegionPaddingWidth: 2,
    bpPerPx: 2,
  }

  function findBlock(
    blocks: BaseBlock[],
    refName: string,
    start: number,
    end: number,
  ) {
    return blocks.find(
      b =>
        b.refName === refName &&
        b.start === start &&
        b.end === end &&
        b.type === 'ContentBlock',
    )
  }

  it('have matching offsetPx for all visible regions when viewing first regions', () => {
    const view = { ...baseView, offsetPx: 0 }
    const dynamicBlocks = calculateVisibleRegions(view).getBlocks()
    const staticBlocks = calculateStaticBlocks(view, true, true, 1).getBlocks()

    const dynamicChr1 = findBlock(dynamicBlocks, 'chr1', 1000, 2000)
    const staticChr1 = findBlock(staticBlocks, 'chr1', 1000, 2000)
    expect(dynamicChr1?.offsetPx).toEqual(0)
    expect(staticChr1?.offsetPx).toEqual(0)

    const dynamicChr2 = findBlock(dynamicBlocks, 'chr2', 5000, 6000)
    const staticChr2 = findBlock(staticBlocks, 'chr2', 5000, 6000)
    if (dynamicChr2 && staticChr2) {
      expect(dynamicChr2.offsetPx).toEqual(staticChr2.offsetPx)
      expect(staticChr2.offsetPx).toEqual(502)
    }
  })

  it('have matching offsetPx for all visible regions when viewing middle regions', () => {
    const view = { ...baseView, offsetPx: 502 }
    const dynamicBlocks = calculateVisibleRegions(view).getBlocks()
    const staticBlocks = calculateStaticBlocks(view, true, true, 1).getBlocks()

    const dynamicChr2 = findBlock(dynamicBlocks, 'chr2', 5000, 6000)
    const staticChr2 = findBlock(staticBlocks, 'chr2', 5000, 6000)
    if (dynamicChr2 && staticChr2) {
      expect(dynamicChr2.offsetPx).toEqual(staticChr2.offsetPx)
      expect(staticChr2.offsetPx).toEqual(502)
    }

    const dynamicChr3 = findBlock(dynamicBlocks, 'chr3', 10000, 11000)
    const staticChr3 = findBlock(staticBlocks, 'chr3', 10000, 11000)
    if (dynamicChr3 && staticChr3) {
      expect(dynamicChr3.offsetPx).toEqual(staticChr3.offsetPx)
      expect(staticChr3.offsetPx).toEqual(1004)
    }
  })

  it('have matching offsetPx when multiple regions are offscreen to the left', () => {
    const view = { ...baseView, offsetPx: 1506 }
    const dynamicBlocks = calculateVisibleRegions(view).getBlocks()
    const staticBlocks = calculateStaticBlocks(view, true, true, 1).getBlocks()

    const dynamicChr4 = findBlock(dynamicBlocks, 'chr4', 20000, 21000)
    const staticChr4 = findBlock(staticBlocks, 'chr4', 20000, 21000)
    if (dynamicChr4 && staticChr4) {
      expect(dynamicChr4.offsetPx).toEqual(staticChr4.offsetPx)
      expect(staticChr4.offsetPx).toEqual(1506)
    }

    const dynamicChr5 = findBlock(dynamicBlocks, 'chr5', 30000, 31000)
    const staticChr5 = findBlock(staticBlocks, 'chr5', 30000, 31000)
    if (dynamicChr5 && staticChr5) {
      expect(dynamicChr5.offsetPx).toEqual(staticChr5.offsetPx)
      expect(staticChr5.offsetPx).toEqual(2008)
    }
  })

  it('have matching offsetPx across all viewport positions', () => {
    const testOffsets = [0, 250, 502, 750, 1004, 1250, 1506]

    for (const offsetPx of testOffsets) {
      const view = { ...baseView, offsetPx }
      const dynamicBlocks = calculateVisibleRegions(view).getBlocks()
      const staticBlocks = calculateStaticBlocks(
        view,
        true,
        true,
        1,
      ).getBlocks()

      // Check chr1 if visible
      const dynamicChr1 = findBlock(dynamicBlocks, 'chr1', 1000, 2000)
      const staticChr1 = findBlock(staticBlocks, 'chr1', 1000, 2000)
      if (dynamicChr1 && staticChr1) {
        expect(dynamicChr1.offsetPx).toEqual(staticChr1.offsetPx)
        expect(staticChr1.offsetPx).toEqual(0)
      }

      // Check chr2 if visible
      const dynamicChr2 = findBlock(dynamicBlocks, 'chr2', 5000, 6000)
      const staticChr2 = findBlock(staticBlocks, 'chr2', 5000, 6000)
      if (dynamicChr2 && staticChr2) {
        expect(dynamicChr2.offsetPx).toEqual(staticChr2.offsetPx)
        expect(staticChr2.offsetPx).toEqual(502)
      }

      // Check chr3 if visible
      const dynamicChr3 = findBlock(dynamicBlocks, 'chr3', 10000, 11000)
      const staticChr3 = findBlock(staticBlocks, 'chr3', 10000, 11000)
      if (dynamicChr3 && staticChr3) {
        expect(dynamicChr3.offsetPx).toEqual(staticChr3.offsetPx)
        expect(staticChr3.offsetPx).toEqual(1004)
      }

      // Check chr4 if visible
      const dynamicChr4 = findBlock(dynamicBlocks, 'chr4', 20000, 21000)
      const staticChr4 = findBlock(staticBlocks, 'chr4', 20000, 21000)
      if (dynamicChr4 && staticChr4) {
        expect(dynamicChr4.offsetPx).toEqual(staticChr4.offsetPx)
        expect(staticChr4.offsetPx).toEqual(1506)
      }

      // Check chr5 if visible
      const dynamicChr5 = findBlock(dynamicBlocks, 'chr5', 30000, 31000)
      const staticChr5 = findBlock(staticBlocks, 'chr5', 30000, 31000)
      if (dynamicChr5 && staticChr5) {
        expect(dynamicChr5.offsetPx).toEqual(staticChr5.offsetPx)
        expect(staticChr5.offsetPx).toEqual(2008)
      }
    }
  })
})
