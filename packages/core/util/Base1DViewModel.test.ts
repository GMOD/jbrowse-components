import Base1DView from './Base1DViewModel'

test('one', () => {
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

test('two', () => {
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
  expect(model.displayedRegionsTotalPx).toEqual(42400)
})
