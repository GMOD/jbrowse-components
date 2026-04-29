import Base1DView from './Base1DViewModel.ts'

test('create Base1DView and set displayedRegions', () => {
  const model = Base1DView.create({
    bpPerPx: 1,
    offsetPx: 0,
  })
  model.setDisplayedRegions([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 40000 },
    { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 3000 },
  ])
  model.setVolatileWidth(800)
  expect(model.width).toBe(800)
  model.setBpPerPx(2)
  expect(model.bpPerPx).toBe(2)
  expect(model.displayedRegions).toBeTruthy()
})

test('Able to set bpPerPx, width and calculate widths', () => {
  const model = Base1DView.create({
    bpPerPx: 0,
    offsetPx: 0,
  })
  model.setDisplayedRegions([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 40000 },
    { assemblyName: 'volvox', refName: 'ctgB', start: 600, end: 3000 },
  ])
  model.setVolatileWidth(800)
  expect(model.width).toBe(800)
  model.setBpPerPx(1)
  expect(model.bpPerPx).toBe(1)
  // 40000 + (3000 - 600 = 2400) = 42400
  expect(model.totalBp).toEqual(42400)
  // 40000 + (3000 - 600 = 2400) = 42400 / 1 (bpPerPx) = 42400
  expect(model.displayedRegionsTotalPx).toEqual(42400)
  expect(model.interRegionPaddingWidth).toEqual(0)
  expect(model.minimumBlockWidth).toEqual(0)
})

test('Able to set and showAll Regions', () => {
  const model = Base1DView.create({
    bpPerPx: 0,
    offsetPx: 0,
  })
  model.setDisplayedRegions([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 40000 },
    { assemblyName: 'volvox', refName: 'ctgB', start: 600, end: 3000 },
  ])
  model.setVolatileWidth(800)
  expect(model.width).toBe(800)
  model.setBpPerPx(1)
  expect(model.bpPerPx).toBe(1)

  // 400 is expected because the bpPerPx is set to 1
  expect(model.pxToBp(400).offset).toEqual(400)
  model.showAllRegions()
  // offset is equal to zero after making a call to showAllRegions
  expect(model.offsetPx).toEqual(0)
  // bpPerPx should now equal totalbp 42400 / width 800
  expect(model.bpPerPx).toEqual(53)
})

test('Navigate to displayedRegions', () => {
  const model = Base1DView.create({
    bpPerPx: 0,
    offsetPx: 0,
  })
  model.setDisplayedRegions([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 40000 },
  ])
  model.setVolatileWidth(800)
  expect(model.width).toBe(800)
  model.showAllRegions()
  // totalBp 40000 / 800 = 50
  expect(model.bpPerPx).toBe(50)

  model.moveTo(
    { start: 0, end: 40000, offset: 5000, index: 0 },
    { start: 0, end: 40000, offset: 15000, index: 0 },
  )
  // 15000 - 5000 = 1000 / 800
  // zooming To newBpPerPx 12.5
  // the offset is now 5000 start / bpPerPx = 400
  expect(model.offsetPx).toEqual(400)
  // previous bpPerPx was calculated to be 12.5 ...
  // zooming in should be 12.5 / 2 = 6.25
  model.zoomIn()
  expect(model.bpPerPx).toEqual(6.25)
  model.zoomOut()
  expect(model.bpPerPx).toEqual(12.5)

  // lets scroll back to zero since we moved to bp 5000
  model.scroll(-400)
  // offsetPx should be 0 because we have old offsetPx of 400
  // clamp takes 400 + -400 then clamping returns 0
  expect(model.offsetPx).toEqual(0)
})

test('moveTo counts region exactly at minimumBlockWidth as wide enough for padding', () => {
  // ctgA is 100bp → at bpPerPx=1 that is exactly 100px = minimumBlockWidth
  // The >= (not >) comparison means it contributes to numBlocksWideEnough
  const model = Base1DView.create({
    bpPerPx: 1,
    offsetPx: 0,
    minimumBlockWidth: 100,
    interRegionPaddingWidth: 10,
  })
  model.setDisplayedRegions([
    { assemblyName: 'test', refName: 'ctgA', start: 0, end: 100 },
    { assemblyName: 'test', refName: 'ctgB', start: 0, end: 300 },
  ])
  model.setVolatileWidth(800)

  // moveTo: start=index0,offset=50 → end=index1,offset=0
  //   len = (100 - 50) + 0 = 50bp
  //   loop i=0..end.index(1)-1=0: ctgA width = 100/bpPerPx >= 100 → counted
  //   numBlocksWideEnough = 1
  //   targetBpPerPx = 50 / (800 - 10*1) = 50/790
  //   bpToStart = start.offset = 50; paddingPx = 0
  //   scrollPos = round(50 / (50/790)) = 790
  model.moveTo({ index: 0, offset: 50 }, { index: 1, offset: 0 })
  expect(model.bpPerPx).toBeCloseTo(50 / 790, 5)
  expect(model.offsetPx).toBe(790)
})

test('moveTo boundary: region just below minimumBlockWidth does not count for padding', () => {
  // ctgA is 99bp → 99px at bpPerPx=1, which is < minimumBlockWidth=100 → not counted
  const model = Base1DView.create({
    bpPerPx: 1,
    offsetPx: 0,
    minimumBlockWidth: 100,
    interRegionPaddingWidth: 10,
  })
  model.setDisplayedRegions([
    { assemblyName: 'test', refName: 'ctgA', start: 0, end: 99 },
    { assemblyName: 'test', refName: 'ctgB', start: 0, end: 300 },
  ])
  model.setVolatileWidth(800)

  // len = (99 - 49) + 0 = 50bp; numBlocksWideEnough = 0
  // targetBpPerPx = 50 / 800; scrollPos = round(49 / (50/800)) = round(784) = 784
  model.moveTo({ index: 0, offset: 49 }, { index: 1, offset: 0 })
  expect(model.bpPerPx).toBeCloseTo(50 / 800, 5)
  expect(model.offsetPx).toBe(784)
})
