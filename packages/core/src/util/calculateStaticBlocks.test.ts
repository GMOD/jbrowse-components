import calculateBlocks from './calculateStaticBlocks'

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
