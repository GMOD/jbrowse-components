import calculateVisibleRegions from './calculateDynamicBlocks'

const ctgA = { assemblyName: 'test', end: 50000, refName: 'ctgA', start: 0 }

test('one', () => {
  expect(
    calculateVisibleRegions({
      bpPerPx: 1,
      displayedRegions: [ctgA],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: 0,
      width: 200,
    }).getBlocks(),
  ).toMatchSnapshot()
})
test('two', () => {
  expect(
    calculateVisibleRegions({
      bpPerPx: 1,
      displayedRegions: [{ ...ctgA, reversed: true }],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: 0,
      width: 200,
    }).getBlocks(),
  ).toMatchSnapshot()
})
test('three', () => {
  expect(
    calculateVisibleRegions({
      bpPerPx: 1,
      displayedRegions: [{ ...ctgA, reversed: true }],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: -100,
      width: 200,
    }).getBlocks(),
  ).toMatchSnapshot()
})
test('four', () => {
  expect(
    calculateVisibleRegions({
      bpPerPx: 1,
      displayedRegions: [ctgA],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: -100,
      width: 350,
    }).getBlocks(),
  ).toMatchSnapshot()
})
test('five', () => {
  expect(
    calculateVisibleRegions({
      bpPerPx: 0.05,
      displayedRegions: [{ ...ctgA, reversed: false }],
      interRegionPaddingWidth: 2,
      minimumBlockWidth: 20,
      offsetPx: 521,
      width: 927,
    }).getBlocks(),
  ).toMatchSnapshot()
})
