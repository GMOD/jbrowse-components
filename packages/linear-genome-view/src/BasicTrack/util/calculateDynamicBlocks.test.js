import calculateVisibleRegions from './calculateDynamicBlocks'

const ctgA = { refName: 'ctgA', start: 0, end: 50000 }

test('one', () => {
  expect(
    calculateVisibleRegions(
      {
        offsetPx: 0,
        viewingRegionWidth: 200,
        effectiveRegions: [ctgA],
        bpPerPx: 1,
      },
      false,
    ).getBlocks(),
  ).toEqual([
    {
      end: 200,
      offsetPx: 0,
      refName: 'ctgA',
      start: 0,
      parentRegion: ctgA,
      isLeftEndOfDisplayedRegion: true,
      isRightEndOfDisplayedRegion: false,
      key: 'ctgA:1-200',
      widthPx: 200,
    },
  ])
})
test('two', () => {
  expect(
    calculateVisibleRegions(
      {
        offsetPx: 0,
        viewingRegionWidth: 200,
        effectiveRegions: [ctgA],
        bpPerPx: 1,
      },
      true,
    ).getBlocks(),
  ).toEqual([
    {
      end: 50000,
      offsetPx: 0,
      refName: 'ctgA',
      start: 49800,
      parentRegion: ctgA,
      isLeftEndOfDisplayedRegion: true,
      isRightEndOfDisplayedRegion: false,
      key: 'ctgA:49801-50000',
      widthPx: 200,
    },
  ])
})
test('three', () => {
  expect(
    calculateVisibleRegions(
      {
        offsetPx: -100,
        viewingRegionWidth: 200,
        effectiveRegions: [ctgA],
        bpPerPx: 1,
      },
      true,
    ).getBlocks(),
  ).toEqual([
    {
      end: 50000,
      offsetPx: 0,
      refName: 'ctgA',
      start: 49900,
      parentRegion: ctgA,
      isLeftEndOfDisplayedRegion: true,
      isRightEndOfDisplayedRegion: false,
      key: 'ctgA:49901-50000',
      widthPx: 100,
    },
  ])
})
test('four', () => {
  expect(
    calculateVisibleRegions(
      {
        offsetPx: -100,
        viewingRegionWidth: 350,
        effectiveRegions: [ctgA],
        bpPerPx: 1,
      },
      false,
    ).getBlocks(),
  ).toEqual([
    {
      end: 250,
      offsetPx: 0,
      refName: 'ctgA',
      start: 0,
      parentRegion: ctgA,
      isLeftEndOfDisplayedRegion: true,
      isRightEndOfDisplayedRegion: false,
      key: 'ctgA:1-250',
      widthPx: 250,
    },
  ])
})
test('five', () => {
  expect(
    calculateVisibleRegions(
      {
        offsetPx: 521,
        viewingRegionWidth: 927,
        effectiveRegions: [ctgA],
        bpPerPx: 0.05,
      },
      false,
    ).getBlocks(),
  ).toEqual([
    {
      end: 72.4,
      offsetPx: 521,
      refName: 'ctgA',
      start: 26.05,
      parentRegion: ctgA,
      isLeftEndOfDisplayedRegion: false,
      isRightEndOfDisplayedRegion: false,
      key: 'ctgA:27.05-72.4',
      widthPx: 927.0000000000001,
    },
  ])
})
