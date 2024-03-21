import Adapter from './FromConfigRegionsAdapter'
import regionsConfigSchema from './configSchema'

test('adapter can fetch regions 1', async () => {
  const features = [
    { end: 400, refName: 'ctgA', start: 250, uniqueId: 'one' },
    { end: 300, refName: 'ctgA', start: 150, uniqueId: 'two' },
    { end: 60, refName: 'ctgB', start: 50, uniqueId: 'three' },
  ]
  const adapter = new Adapter(regionsConfigSchema.create({ features }))
  const result = await adapter.getRegions()
  expect(result).toEqual([
    { end: 400, refName: 'ctgA', start: 150 },
    { end: 60, refName: 'ctgB', start: 50 },
  ])
})

test('adapter can fetch regions 2', async () => {
  const features = [
    { end: 60, refName: 'ctgB', start: 50, uniqueId: 'three' },
    { end: 300, refName: 'ctgA', start: 150, uniqueId: 'two' },
    { end: 400, refName: 'ctgA', start: 250, uniqueId: 'one' },
  ]
  const adapter = new Adapter(regionsConfigSchema.create({ features }))
  const result = await adapter.getRegions()
  expect(result).toEqual([
    { end: 400, refName: 'ctgA', start: 150 },
    { end: 60, refName: 'ctgB', start: 50 },
  ])
})

test('adapter can fetch regions 3', async () => {
  const features = [
    { end: 300, refName: 'ctgA', start: 150, uniqueId: 'two' },
    { end: 400, refName: 'ctgA', start: 250, uniqueId: 'one' },
    { end: 60, refName: 'ctgB', start: 50, uniqueId: 'three' },
  ]
  const adapter = new Adapter(regionsConfigSchema.create({ features }))
  const result = await adapter.getRegions()
  expect(result).toEqual([
    { end: 400, refName: 'ctgA', start: 150 },
    { end: 60, refName: 'ctgB', start: 50 },
  ])
})

test('adapter can fetch regions 4', async () => {
  const features = [
    { end: 300, refName: 'ctgA', start: 150, uniqueId: 'two' },
    { end: 400, refName: 'ctgA', start: 300, uniqueId: 'onePrime' },
    { end: 60, refName: 'ctgB', start: 50, uniqueId: 'three' },
  ]
  const adapter = new Adapter(regionsConfigSchema.create({ features }))
  const result = await adapter.getRegions()
  expect(result).toEqual([
    { end: 400, refName: 'ctgA', start: 150 },
    { end: 60, refName: 'ctgB', start: 50 },
  ])
})
