import calculateBlocks from './calculateStaticBlocks'

import type { BaseBlock } from './blockTypes'

describe('block calculation', () => {
  it('can calculate some blocks 1', () => {
    const blocks1 = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 0,
      displayedRegions: [
        { assemblyName: 'test', refName: 'ctgA', start: 0, end: 10000 },
      ],
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    })

    const blocks2 = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 0,
      displayedRegions: [
        { assemblyName: 'test', refName: 'ctgA', start: 0, end: 10000 },
      ],
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    })
    expect(blocks1).toMatchSnapshot()
    expect(blocks1).toEqual(blocks2)
  })

  it('can calculate some blocks 2', () => {
    const blocks = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 30,
      displayedRegions: [
        { assemblyName: 'test', refName: 'ctgA', start: 0, end: 100 },
        { assemblyName: 'test', refName: 'ctgB', start: 100, end: 200 },
      ],
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    })
    expect(blocks).toMatchSnapshot()
  })

  it('can calculate some blocks (should be empty because offscreen to the right)', () => {
    const blockSet = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 2000,
      displayedRegions: [
        { assemblyName: 'test', refName: 'ctgA', start: 0, end: 100 },
        { assemblyName: 'test', refName: 'ctgB', start: 100, end: 200 },
      ],
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    })
    expect(blockSet.getBlocks()).toEqual([])
  })

  it('can calculate some blocks (should be empty because offscreen to the left)', () => {
    const blockSet = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: -2000,
      displayedRegions: [
        { assemblyName: 'test', refName: 'ctgA', start: 0, end: 100 },
        { assemblyName: 'test', refName: 'ctgB', start: 100, end: 200 },
      ],
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    })
    expect(blockSet.getBlocks()).toEqual([])
  })

  it('can calculate some blocks 5', () => {
    const blocks = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 5000,
      displayedRegions: [
        { assemblyName: 'test', refName: 'ctgA', start: 0, end: 10000 },
        { assemblyName: 'test', refName: 'ctgB', start: 100, end: 10000 },
      ],
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    })
    expect(blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 6', () => {
    const blockSet = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 0,
      displayedRegions: [
        { assemblyName: 'test', refName: 'ctgA', start: 0, end: 200 },
        { assemblyName: 'test', refName: 'ctgB', start: 0, end: 1000 },
      ],
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    })
    expect(blockSet).toMatchSnapshot()
    expect(blockSet.blocks[1]!.offsetPx).toBe(0)
  })

  it('can calculate some blocks 7', () => {
    const blocks = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 801,
      displayedRegions: [
        { assemblyName: 'test', refName: 'ctgA', start: 0, end: 200 },
        { assemblyName: 'test', refName: 'ctgB', start: 0, end: 1000 },
      ],
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    })
    expect(blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 8', () => {
    const blocks = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 1600,
      displayedRegions: [
        { assemblyName: 'test', refName: 'ctgA', start: 0, end: 200 },
        { assemblyName: 'test', refName: 'ctgB', start: 0, end: 10000000 },
      ],
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    })
    expect(blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 9', () => {
    const blockSet = calculateBlocks({
      width: 800,
      offsetPx: 1069,
      bpPerPx: 2,
      displayedRegions: [
        { assemblyName: 'test', refName: 'ctgA', start: 0, end: 50000 },
        { assemblyName: 'test', refName: 'ctgB', start: 0, end: 300 },
      ],
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    })
    expect(blockSet).toMatchSnapshot()
  })

  it('can calculate some blocks 10', () => {
    const blockSet = calculateBlocks({
      width: 800,
      offsetPx: 0,
      bpPerPx: 0.05,
      displayedRegions: [
        { assemblyName: 'test', refName: 'ctgA', start: 100, end: 200 },
        { assemblyName: 'test', refName: 'ctgA', start: 300, end: 400 },
      ],
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    })
    expect(blockSet.blocks[1]!.offsetPx).toBe(0)
    expect(blockSet.blocks).toMatchSnapshot()
  })
})

describe('reverse block calculation', () => {
  test('1', () => {
    const blocks = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 0,
      displayedRegions: [
        {
          assemblyName: 'test',
          refName: 'ctgA',
          start: 0,
          end: 10000,
          reversed: true,
        },
      ],
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    })
    expect(blocks).toMatchSnapshot()
  })
})

describe('reversed displayed regions', () => {
  test('without elided region', () => {
    const blocks = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 0,
      displayedRegions: [
        {
          assemblyName: 'test',
          refName: 'ctgA',
          start: 100,
          end: 200,
          reversed: true,
        },
        {
          assemblyName: 'test',
          refName: 'ctgA',
          start: 500,
          end: 600,
          reversed: true,
        },
      ],
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    })
    expect(blocks).toMatchSnapshot()
  })
  test('with elided region', () => {
    const blocks = calculateBlocks(
      {
        bpPerPx: 1,
        width: 800,
        offsetPx: 0,
        minimumBlockWidth: 2,
        displayedRegions: [
          {
            assemblyName: 'test',
            refName: 'ctgA',
            start: 0,
            end: 1,
            reversed: true,
          },
          {
            assemblyName: 'test',
            refName: 'ctgA',
            start: 0,
            end: 10000,
            reversed: true,
          },
        ],
        interRegionPaddingWidth: 2,
      },
      true,
      true,
      1,
      800,
    )
    expect(blocks).toMatchSnapshot()
  })
})

// ai generated test
describe('static blocks have consistent offsetPx across different viewports', () => {
  const baseView = {
    width: 980,
    displayedRegions: [
      { assemblyName: 'test', refName: 'ctgA', start: 0, end: 1000 },
      { assemblyName: 'test', refName: 'ctgA', start: 2000, end: 3000 },
      { assemblyName: 'test', refName: 'ctgA', start: 4000, end: 5000 },
      { assemblyName: 'test', refName: 'ctgA', start: 6000, end: 7000 },
      { assemblyName: 'test', refName: 'ctgA', start: 8000, end: 9000 },
    ],
    minimumBlockWidth: 3,
    interRegionPaddingWidth: 2,
    bpPerPx: 2,
  }

  function findMatchingBlock(blocks: BaseBlock[], start: number, end: number) {
    return blocks.find(
      b => b.start === start && b.end === end && b.type === 'ContentBlock',
    )
  }

  it('blocks have same offsetPx when scrolled to show first region', () => {
    const view1 = { ...baseView, offsetPx: 0 }
    const blocks1 = calculateBlocks(view1).getBlocks()

    const block0_1000 = findMatchingBlock(blocks1, 0, 1000)
    const block2000_3000 = findMatchingBlock(blocks1, 2000, 3000)

    expect(block0_1000?.offsetPx).toBe(0)
    expect(block2000_3000?.offsetPx).toBe(502)
  })

  it('blocks have same offsetPx when scrolled to show middle regions', () => {
    const view2 = { ...baseView, offsetPx: 502 }
    const blocks2 = calculateBlocks(view2).getBlocks()

    const block2000_3000 = findMatchingBlock(blocks2, 2000, 3000)
    const block4000_5000 = findMatchingBlock(blocks2, 4000, 5000)

    expect(block2000_3000?.offsetPx).toBe(502)
    expect(block4000_5000?.offsetPx).toBe(1004)
  })

  it('blocks have same offsetPx regardless of viewport position', () => {
    const view1 = { ...baseView, offsetPx: 0 }
    const view2 = { ...baseView, offsetPx: 502 }
    const view3 = { ...baseView, offsetPx: 1004 }

    const blocks1 = calculateBlocks(view1, true, true, 1).getBlocks()
    const blocks2 = calculateBlocks(view2, true, true, 1).getBlocks()
    const blocks3 = calculateBlocks(view3, true, true, 1).getBlocks()

    const block2000_3000_v1 = findMatchingBlock(blocks1, 2000, 3000)
    const block2000_3000_v2 = findMatchingBlock(blocks2, 2000, 3000)

    expect(block2000_3000_v1?.offsetPx).toBe(502)
    expect(block2000_3000_v2?.offsetPx).toBe(502)

    const block4000_5000_v1 = findMatchingBlock(blocks1, 4000, 5000)
    const block4000_5000_v2 = findMatchingBlock(blocks2, 4000, 5000)
    const block4000_5000_v3 = findMatchingBlock(blocks3, 4000, 5000)

    expect(block4000_5000_v1?.offsetPx).toBe(1004)
    expect(block4000_5000_v2?.offsetPx).toBe(1004)
    expect(block4000_5000_v3?.offsetPx).toBe(1004)

    const block6000_7000_v3 = findMatchingBlock(blocks3, 6000, 7000)
    expect(block6000_7000_v3?.offsetPx).toBe(1506)
  })

  it('blocks for later regions have correct offsetPx with multiple offscreen regions', () => {
    const view = { ...baseView, offsetPx: 1506 }
    const blocks = calculateBlocks(view, true, true, 1).getBlocks()

    const block6000_7000 = findMatchingBlock(blocks, 6000, 7000)
    const block8000_9000 = findMatchingBlock(blocks, 8000, 9000)

    expect(block6000_7000?.offsetPx).toBe(1506)
    expect(block8000_9000?.offsetPx).toBe(2008)
  })
})
