import {
  readConfObject,
  refusingUndeclaredKeys,
} from '@jbrowse/core/configuration'

import configSchema from './configSchema.ts'

function create(snap: Record<string, unknown>) {
  return configSchema.create({
    type: 'LinearWiggleDisplay',
    displayId: 'test',
    ...snap,
  })
}

test('a bare color is the constant', () => {
  const conf = create({ color: 'green' })
  expect(readConfObject(conf, ['color', 'value'])).toBe('green')
  expect(readConfObject(conf, ['color', 'field'])).toBeUndefined()
})

// A subtrack's colour is `rowColor`'s, so `source` is no colour field.
test('the field is score, and any other name is refused', () => {
  expect(
    readConfObject(create({ color: { field: 'score' } }), ['color', 'field']),
  ).toBe('score')
  expect(() => create({ color: { field: 'source' } })).toThrow()
  expect(() => create({ color: { field: 'pvalue' } })).toThrow()
})

test('the object carries the scale and the slots it reads', () => {
  const conf = create({
    color: {
      field: 'score',
      scale: 'threshold',
      domain: [2],
      range: ['#2166ac', '#b2182b'],
    },
  })
  expect(readConfObject(conf, ['color', 'scale'])).toBe('threshold')
  expect(readConfObject(conf, ['color', 'domain'])).toEqual(['2'])
  expect(readConfObject(conf, ['color', 'range'])).toEqual([
    '#2166ac',
    '#b2182b',
  ])
})

test('a write refuses an undeclared key by name', () => {
  expect(() =>
    refusingUndeclaredKeys(() =>
      create({ color: { field: 'score', pivot: 2 } }),
    ),
  ).toThrow('WiggleColor takes')
})

test('a scale the display does not paint is refused', () => {
  expect(() =>
    create({ color: { field: 'score', scale: 'ordinal' } }),
  ).toThrow()
})

test("v4's rendering names load as the mark they draw, and an unknown one is refused", () => {
  const read = (defaultRendering: string) => {
    const conf = create({ defaultRendering })
    return [readConfObject(conf, 'mark'), readConfObject(conf, 'interpolate')]
  }
  expect(read('xyplot')).toEqual(['bar', 'step'])
  expect(read('scatter')).toEqual(['point', 'step'])
  expect(read('density')).toEqual(['span', 'step'])
  expect(read('line')).toEqual(['line', 'step'])
  expect(read('linecenter')).toEqual(['line', 'linear'])
  expect(() => create({ defaultRendering: 'multirowarea' })).toThrow()
  expect(readConfObject(create({ mark: 'point' }), 'mark')).toBe('point')
})

test('the old cross hatch and tick flags land on the scale, beside a scale the config writes', () => {
  const conf = create({
    displayCrossHatches: true,
    minimalTicks: true,
    scales: { y: { type: 'log', minimalTicks: false } },
  })
  expect(readConfObject(conf, ['scales', 'y', 'grid'])).toBe(true)
  expect(readConfObject(conf, ['scales', 'y', 'type'])).toBe('log')
  expect(readConfObject(conf, ['scales', 'y', 'minimalTicks'])).toBe(false)
})

describe('the slots v4 declared on the display', () => {
  const y = (
    snap: Record<string, unknown>,
    slot: 'domainMin' | 'domainMax' | 'type' | 'domainQuantile',
  ) => readConfObject(create(snap), ['scales', 'y', slot])

  test('a fixed range and a log scale reach scales.y, with no warning', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const v4 = { minScore: 0, maxScore: 50, scaleType: 'log' }
    expect(y(v4, 'domainMin')).toBe(0)
    expect(y(v4, 'domainMax')).toBe(50)
    expect(y(v4, 'type')).toBe('log')
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test("v4's unset sentinels leave the range to the data", () => {
    const unset = { minScore: Number.MIN_VALUE, maxScore: Number.MAX_VALUE }
    expect(y(unset, 'domainMin')).toBe(y({}, 'domainMin'))
    expect(y(unset, 'domainMax')).toBe(y({}, 'domainMax'))
  })

  test('autoscale follows the extremes, as v4 did', () => {
    expect(y({ autoscale: 'local' }, 'domainQuantile')).toBe(1)
  })

  test('a slot with no successor is let go without a warning', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    create({ numStdDev: 3, inverted: true })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test("a renderers block gives the display its renderer's colour", () => {
    const conf = create({
      renderers: { XYPlotRenderer: { color: 'purple', filled: false } },
    })
    expect(readConfObject(conf, ['color', 'value'])).toBe('purple')
  })
})
