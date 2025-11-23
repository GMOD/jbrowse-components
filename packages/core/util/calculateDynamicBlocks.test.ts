import calculateVisibleRegions from './calculateDynamicBlocks'
import calculateStaticBlocks from './calculateStaticBlocks'

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
