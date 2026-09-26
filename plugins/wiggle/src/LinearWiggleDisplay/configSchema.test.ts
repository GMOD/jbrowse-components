import { readConfObject } from '@jbrowse/core/configuration'

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

test('the field is score or source, and any other name is refused', () => {
  expect(
    readConfObject(create({ color: { field: 'source' } }), ['color', 'field']),
  ).toBe('source')
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

test('an undeclared key is refused by name', () => {
  expect(() => create({ color: { field: 'score', pivot: 2 } })).toThrow(
    'WiggleColor takes',
  )
})

test('a scale the display does not paint is refused', () => {
  expect(() =>
    create({ color: { field: 'score', scale: 'ordinal' } }),
  ).toThrow()
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
