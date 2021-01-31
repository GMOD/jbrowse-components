import Adapter from './FromConfigRegionsAdapter'
import { regionsConfigSchema } from './configSchema'

test('adapter can fetch regions 1', async () => {
  const features = [
    { uniqueId: 'one', refName: 'ctgA', start: 250, end: 400 },
    { uniqueId: 'two', refName: 'ctgA', start: 150, end: 300 },
    { uniqueId: 'three', refName: 'ctgB', start: 50, end: 60 },
  ]
  const adapter = new Adapter(regionsConfigSchema.create({ features }))
  const result = await adapter.getRegions()
  expect(result).toEqual([
    { refName: 'ctgA', start: 150, end: 400 },
    { refName: 'ctgB', start: 50, end: 60 },
  ])
})

test('adapter can fetch regions 2', async () => {
  const features = [
    { uniqueId: 'three', refName: 'ctgB', start: 50, end: 60 },
    { uniqueId: 'two', refName: 'ctgA', start: 150, end: 300 },
    { uniqueId: 'one', refName: 'ctgA', start: 250, end: 400 },
  ]
  const adapter = new Adapter(regionsConfigSchema.create({ features }))
  const result = await adapter.getRegions()
  expect(result).toEqual([
    { refName: 'ctgA', start: 150, end: 400 },
    { refName: 'ctgB', start: 50, end: 60 },
  ])
})

test('adapter can fetch regions 3', async () => {
  const features = [
    { uniqueId: 'two', refName: 'ctgA', start: 150, end: 300 },
    { uniqueId: 'one', refName: 'ctgA', start: 250, end: 400 },
    { uniqueId: 'three', refName: 'ctgB', start: 50, end: 60 },
  ]
  const adapter = new Adapter(regionsConfigSchema.create({ features }))
  const result = await adapter.getRegions()
  expect(result).toEqual([
    { refName: 'ctgA', start: 150, end: 400 },
    { refName: 'ctgB', start: 50, end: 60 },
  ])
})

test('adapter can fetch regions 4', async () => {
  const features = [
    { uniqueId: 'two', refName: 'ctgA', start: 150, end: 300 },
    { uniqueId: 'onePrime', refName: 'ctgA', start: 300, end: 400 },
    { uniqueId: 'three', refName: 'ctgB', start: 50, end: 60 },
  ]
  const adapter = new Adapter(regionsConfigSchema.create({ features }))
  const result = await adapter.getRegions()
  expect(result).toEqual([
    { refName: 'ctgA', start: 150, end: 400 },
    { refName: 'ctgB', start: 50, end: 60 },
  ])
})
