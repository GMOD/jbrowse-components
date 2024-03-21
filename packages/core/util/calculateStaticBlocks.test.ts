import calculateBlocks from './calculateStaticBlocks'

describe('block calculation', () => {
  it('can calculate some blocks 1', () => {
    const blocks1 = calculateBlocks({
      bpPerPx: 1,
      displayedRegions: [
        { assemblyName: 'test', end: 10000, refName: 'ctgA', start: 0 },
      ],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: 0,
      width: 800,
    })

    const blocks2 = calculateBlocks({
      bpPerPx: 1,
      displayedRegions: [
        { assemblyName: 'test', end: 10000, refName: 'ctgA', start: 0 },
      ],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: 0,
      width: 800,
    })
    expect(blocks1).toMatchSnapshot()
    expect(blocks1).toEqual(blocks2)
  })

  it('can calculate some blocks 2', () => {
    const blocks = calculateBlocks({
      bpPerPx: 1,
      displayedRegions: [
        { assemblyName: 'test', end: 100, refName: 'ctgA', start: 0 },
        { assemblyName: 'test', end: 200, refName: 'ctgB', start: 100 },
      ],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: 30,
      width: 800,
    })
    expect(blocks).toMatchSnapshot()
  })

  it('can calculate some blocks (should be empty because offscreen to the right)', () => {
    const blockSet = calculateBlocks({
      bpPerPx: 1,
      displayedRegions: [
        { assemblyName: 'test', end: 100, refName: 'ctgA', start: 0 },
        { assemblyName: 'test', end: 200, refName: 'ctgB', start: 100 },
      ],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: 2000,
      width: 800,
    })
    expect(blockSet.getBlocks()).toEqual([])
  })

  it('can calculate some blocks (should be empty because offscreen to the left)', () => {
    const blockSet = calculateBlocks({
      bpPerPx: 1,
      displayedRegions: [
        { assemblyName: 'test', end: 100, refName: 'ctgA', start: 0 },
        { assemblyName: 'test', end: 200, refName: 'ctgB', start: 100 },
      ],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: -2000,
      width: 800,
    })
    expect(blockSet.getBlocks()).toEqual([])
  })

  it('can calculate some blocks 5', () => {
    const blocks = calculateBlocks({
      bpPerPx: 1,
      displayedRegions: [
        { assemblyName: 'test', end: 10000, refName: 'ctgA', start: 0 },
        { assemblyName: 'test', end: 10000, refName: 'ctgB', start: 100 },
      ],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: 5000,
      width: 800,
    })
    expect(blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 6', () => {
    const blockSet = calculateBlocks({
      bpPerPx: 1,
      displayedRegions: [
        { assemblyName: 'test', end: 200, refName: 'ctgA', start: 0 },
        { assemblyName: 'test', end: 1000, refName: 'ctgB', start: 0 },
      ],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: 0,
      width: 800,
    })
    expect(blockSet).toMatchSnapshot()
    expect(blockSet.blocks[1].offsetPx).toBe(0)
  })

  it('can calculate some blocks 7', () => {
    const blocks = calculateBlocks({
      bpPerPx: 1,
      displayedRegions: [
        { assemblyName: 'test', end: 200, refName: 'ctgA', start: 0 },
        { assemblyName: 'test', end: 1000, refName: 'ctgB', start: 0 },
      ],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: 801,
      width: 800,
    })
    expect(blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 8', () => {
    const blocks = calculateBlocks({
      bpPerPx: 1,
      displayedRegions: [
        { assemblyName: 'test', end: 200, refName: 'ctgA', start: 0 },
        { assemblyName: 'test', end: 10000000, refName: 'ctgB', start: 0 },
      ],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: 1600,
      width: 800,
    })
    expect(blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 9', () => {
    const blockSet = calculateBlocks({
      bpPerPx: 2,
      displayedRegions: [
        { assemblyName: 'test', end: 50000, refName: 'ctgA', start: 0 },
        { assemblyName: 'test', end: 300, refName: 'ctgB', start: 0 },
      ],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: 1069,
      width: 800,
    })
    expect(blockSet).toMatchSnapshot()
  })

  it('can calculate some blocks 10', () => {
    const blockSet = calculateBlocks({
      bpPerPx: 0.05,
      displayedRegions: [
        { assemblyName: 'test', end: 200, refName: 'ctgA', start: 100 },
        { assemblyName: 'test', end: 400, refName: 'ctgA', start: 300 },
      ],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: 0,
      width: 800,
    })
    // console.log(JSON.stringify(blockSet.blocks, null, '  '))
    expect(blockSet.blocks[1].offsetPx).toBe(0)
    expect(blockSet.blocks).toMatchSnapshot()
  })
})

describe('reverse block calculation', () => {
  test('1', () => {
    const blocks = calculateBlocks({
      bpPerPx: 1,
      displayedRegions: [
        {
          assemblyName: 'test',
          end: 10000,
          refName: 'ctgA',
          reversed: true,
          start: 0,
        },
      ],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: 0,
      width: 800,
    })
    expect(blocks).toMatchSnapshot()
  })
})

describe('reversed displayed regions', () => {
  test('without elided region', () => {
    const blocks = calculateBlocks({
      bpPerPx: 1,
      displayedRegions: [
        {
          assemblyName: 'test',
          end: 200,
          refName: 'ctgA',
          reversed: true,
          start: 100,
        },
        {
          assemblyName: 'test',
          end: 600,
          refName: 'ctgA',
          reversed: true,
          start: 500,
        },
      ],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: 0,
      width: 800,
    })
    expect(blocks).toMatchSnapshot()
  })
  test('with elided region', () => {
    const blocks = calculateBlocks(
      {
        bpPerPx: 1,
        displayedRegions: [
          {
            assemblyName: 'test',
            end: 1,
            refName: 'ctgA',
            reversed: true,
            start: 0,
          },
          {
            assemblyName: 'test',
            end: 10000,
            refName: 'ctgA',
            reversed: true,
            start: 0,
          },
        ],
        interRegionPaddingWidth: 2,
        minimumBlockWidth: 2,
        offsetPx: 0,
        width: 800,
      },
      true,
      true,
      1,
      800,
    )
    expect(blocks).toMatchSnapshot()
  })
})
