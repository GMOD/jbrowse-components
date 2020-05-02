import calculateBlocks from './calculateStaticBlocks'

describe('block calculation', () => {
  it('can calculate some blocks 1', () => {
    const blocks1 = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 0,
      displayedRegions: [
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10000 },
      ],
    })

    const blocks2 = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 0,
      displayedRegions: [
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10000 },
      ],
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
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgB', start: 100, end: 200 },
      ],
    })
    expect(blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 3', () => {
    const blockSet = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 1000,
      displayedRegions: [
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgB', start: 100, end: 200 },
      ],
    })
    expect(blockSet.getBlocks()).toEqual([])
  })

  it('can calculate some blocks 4', () => {
    const blockSet = calculateBlocks(
      {
        bpPerPx: 1,
        width: 800,
        offsetPx: -1000,
        displayedRegions: [
          // @ts-ignore
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
          // @ts-ignore
          { assemblyName: 'volvox', refName: 'ctgB', start: 100, end: 200 },
        ],
      },
      {
        testEnv: true,
      },
    )
    expect(blockSet.getBlocks()).toEqual([])
  })

  it('can calculate some blocks 5', () => {
    const blocks = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 5000,
      displayedRegions: [
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10000 },
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgB', start: 100, end: 10000 },
      ],
    })
    expect(blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 6', () => {
    const blockSet = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 0,
      displayedRegions: [
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 200 },
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 1000 },
      ],
    })
    expect(blockSet).toMatchSnapshot()
    expect(blockSet.blocks[1].offsetPx).toBe(0)
  })

  it('can calculate some blocks 7', () => {
    const blocks = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 801,
      displayedRegions: [
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 200 },
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 1000 },
      ],
    })
    expect(blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 8', () => {
    const blocks = calculateBlocks({
      bpPerPx: 1,
      width: 800,
      offsetPx: 1600,
      displayedRegions: [
        // @ts-ignore
        { refName: 'ctgA', start: 0, end: 200 },
        // @ts-ignore
        { refName: 'ctgB', start: 0, end: 10000000 },
      ],
      configuration: 'fakeReference',
    })
    expect(blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 9', () => {
    const blockSet = calculateBlocks({
      width: 800,
      offsetPx: 1069,
      bpPerPx: 2,
      displayedRegions: [
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50000 },
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 300 },
      ],
      configuration: 'fakeReference',
    })
    expect(blockSet).toMatchSnapshot()
  })

  it('can calculate some blocks 10', () => {
    const blockSet = calculateBlocks({
      width: 800,
      offsetPx: 0,
      bpPerPx: 0.05,
      displayedRegions: [
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgA', start: 100, end: 200 },
        // @ts-ignore
        { assemblyName: 'volvox', refName: 'ctgA', start: 300, end: 400 },
      ],
      configuration: 'fakeReference',
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
      width: 800,
      offsetPx: 0,
      displayedRegions: [
        // @ts-ignore
        {
          assemblyName: 'volvox',
          refName: 'ctgA',
          start: 0,
          end: 10000,
          reversed: true,
        },
      ],
    })
    expect(blocks).toMatchSnapshot()
  })
})

describe('reversed displayed regions', () => {
  test('without elided region', () => {
    const blocks = calculateBlocks(
      {
        bpPerPx: 1,
        width: 800,
        offsetPx: 0,
        displayedRegions: [
          // @ts-ignore
          {
            assemblyName: 'volvox',
            refName: 'ctgA',
            start: 100,
            end: 200,
            reversed: true,
          },
          // @ts-ignore
          {
            assemblyName: 'volvox',
            refName: 'ctgA',
            start: 500,
            end: 600,
            reversed: true,
          },
        ],
      },
      true,
    )
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
          // @ts-ignore
          {
            assemblyName: 'volvox',
            refName: 'ctgA',
            start: 0,
            end: 1,
            reversed: true,
          },
          // @ts-ignore
          {
            assemblyName: 'volvox',
            refName: 'ctgA',
            start: 0,
            end: 10000,
            reversed: true,
          },
        ],
      },
      1,
    )
    expect(blocks).toMatchSnapshot()
  })
})
