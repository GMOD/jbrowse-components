import { getNiceDomain, getScale } from '@jbrowse/wiggle-core'

import { formatScore } from './util.ts'

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

test('test minScore', () => {
  const scaleType = 'linear'
  const domain = [0, 100] as const
  const bounds = [50, undefined] as const
  const ret = getNiceDomain({ zero: true, scaleType, domain, bounds })
  expect(ret).toEqual([50, 100])
})

test('test min and max score', () => {
  const scaleType = 'linear'
  const domain = [1, 100] as const
  const bounds = [undefined, 70] as const
  const ret = getNiceDomain({ zero: true, scaleType, domain, bounds })
  expect(ret).toEqual([0, 70])
})

describe('formatScore', () => {
  test('drops the padding toPrecision adds', () => {
    expect(formatScore(10)).toBe('10')
    expect(formatScore(2.5)).toBe('2.5')
    expect(formatScore(0.001)).toBe('0.001')
  })

  test('keeps a value toPrecision rounds up out of the fractional form', () => {
    // "100", with no decimal point for a trailing-zero strip to anchor on
    expect(formatScore(99.95)).toBe('100')
    expect(formatScore(-99.999)).toBe('-100')
  })

  test('passes the >=100 and zero branches through', () => {
    expect(formatScore(0)).toBe('0')
    expect(formatScore(1500.4)).toBe('1500')
  })
})
