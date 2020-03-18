import calculateVisibleRegions from './calculateDynamicBlocks'

const ctgA = { refName: 'ctgA', start: 0, end: 50000 }

test('one', () => {
  expect(
    calculateVisibleRegions(
      {
        offsetPx: 0,
        width: 200,
        displayedRegions: [ctgA],
        bpPerPx: 1,
      },
      false,
    ).getBlocks(),
  ).toMatchSnapshot()
})
test('two', () => {
  expect(
    calculateVisibleRegions(
      {
        offsetPx: 0,
        width: 200,
        displayedRegions: [ctgA],
        bpPerPx: 1,
      },
      true,
    ).getBlocks(),
  ).toMatchSnapshot()
})
test('three', () => {
  expect(
    calculateVisibleRegions(
      {
        offsetPx: -100,
        width: 200,
        displayedRegions: [ctgA],
        bpPerPx: 1,
      },
      true,
    ).getBlocks(),
  ).toMatchSnapshot()
})
test('four', () => {
  expect(
    calculateVisibleRegions(
      {
        offsetPx: -100,
        width: 350,
        displayedRegions: [ctgA],
        bpPerPx: 1,
      },
      false,
    ).getBlocks(),
  ).toMatchSnapshot()
})
test('five', () => {
  expect(
    calculateVisibleRegions(
      {
        offsetPx: 521,
        width: 927,
        displayedRegions: [ctgA],
        bpPerPx: 0.05,
      },
      false,
    ).getBlocks(),
  ).toMatchSnapshot()
})
