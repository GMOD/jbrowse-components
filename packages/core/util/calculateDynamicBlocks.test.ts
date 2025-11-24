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
describe('equivalent dynamic and static blocks are at the same offset', () => {
  const baseView = {
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
  }
  it('when multiple static blocks are offscreen to the left', () => {
    const view = { ...baseView, offsetPx: 550, bpPerPx: 5 }
    const dynamicBlocks = calculateVisibleRegions(view).getBlocks()
    const staticBlocks = calculateStaticBlocks(view).getBlocks()
    expect(dynamicBlocks.at(1)?.offsetPx).toEqual(staticBlocks.at(6)?.offsetPx)
    expect(dynamicBlocks.at(2)?.offsetPx).toEqual(staticBlocks.at(7)?.offsetPx)
    expect(dynamicBlocks.at(3)?.offsetPx).toEqual(staticBlocks.at(8)?.offsetPx)
    expect(dynamicBlocks.at(4)?.offsetPx).toEqual(staticBlocks.at(9)?.offsetPx)
    expect(dynamicBlocks.at(5)?.offsetPx).toEqual(staticBlocks.at(10)?.offsetPx)
  })
  it('when no static blocks are offscreen to the left due to blockWidth', () => {
    const view = { ...baseView, offsetPx: 1800, bpPerPx: 2 }
    const dynamicBlocks = calculateVisibleRegions(view).getBlocks()
    const staticBlocks = calculateStaticBlocks(view).getBlocks()
    expect(dynamicBlocks.at(1)?.offsetPx).toEqual(staticBlocks.at(1)?.offsetPx)
    expect(dynamicBlocks.at(2)?.offsetPx).toEqual(staticBlocks.at(2)?.offsetPx)
    expect(dynamicBlocks.at(3)?.offsetPx).toEqual(staticBlocks.at(3)?.offsetPx)
  })
  it('when the left edge is inside an InterRegionPaddingBlock', () => {
    const view = { ...baseView, offsetPx: 501, bpPerPx: 2 }
    const dynamicBlocks = calculateVisibleRegions(view).getBlocks()
    const staticBlocks = calculateStaticBlocks(view).getBlocks()
    expect(dynamicBlocks.at(1)?.offsetPx).toEqual(staticBlocks.at(3)?.offsetPx)
    expect(dynamicBlocks.at(2)?.offsetPx).toEqual(staticBlocks.at(4)?.offsetPx)
    expect(dynamicBlocks.at(3)?.offsetPx).toEqual(staticBlocks.at(5)?.offsetPx)
  })
})
