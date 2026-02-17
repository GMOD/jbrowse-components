import calculateVisibleRegions from './calculateDynamicBlocks.ts'

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

test('off-screen regions contribute padding to block positions', () => {
  const regions = [
    { assemblyName: 'test', refName: 'chr1', start: 0, end: 1000 },
    { assemblyName: 'test', refName: 'chr2', start: 0, end: 1000 },
    { assemblyName: 'test', refName: 'chr3', start: 0, end: 1000 },
  ]
  const blockSet = calculateVisibleRegions({
    offsetPx: 2004,
    width: 800,
    displayedRegions: regions,
    bpPerPx: 1,
    minimumBlockWidth: 3,
    interRegionPaddingWidth: 2,
  })
  const chr3Blocks = blockSet.contentBlocks.filter(b => b.refName === 'chr3')
  expect(chr3Blocks.length).toBeGreaterThan(0)
  expect(chr3Blocks[0]!.offsetPx).toBe(2004)
})
