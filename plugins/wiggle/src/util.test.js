import { getNiceDomain, getScale } from './util'

test('linear scale', () => {
  const scaleType = 'linear'
  const domain = [0, 100]
  const range = [0, 100]
  const scale = getScale({ scaleType, domain, range })
  expect(scale.domain()).toEqual(domain)
})

test('log scale', () => {
  const scaleType = 'log'
  const domain = [1, 100]
  const range = [0, 100]
  const scale = getScale({ scaleType, domain, range })
  expect(scale.domain()).toEqual([1, 128])
})

test('test inverted', () => {
  const scaleType = 'log'
  const inverted = true
  const domain = [1, 100]
  const range = [0, 100]
  const scale = getScale({ scaleType, domain, range, inverted })
  expect(scale.domain()).toEqual([1, 128])
  expect(scale.range()).toEqual(range.reverse())
})

test('test minScore', () => {
  const scaleType = 'linear'
  const domain = [0, 100]
  const range = [0, 100]
  const bounds = [50, undefined]
  const ret = getNiceDomain({ scaleType, domain, range, bounds })
  expect(ret).toEqual([50, 100])
})

test('test min and max score', () => {
  const scaleType = 'linear'
  const domain = [1, 100]
  const range = [0, 100]
  const bounds = [undefined, 70]
  const ret = getNiceDomain({ scaleType, domain, range, bounds })
  expect(ret).toEqual([0, 70])
})
