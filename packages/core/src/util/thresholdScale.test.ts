import { NO_VALUE_LABEL } from './categoricalField.ts'
import { MISCONFIGURED_COLOR, NO_CATEGORY_COLOR } from './color/index.ts'
import {
  NOT_A_NUMBER_LABEL,
  numericDomain,
  thresholdField,
  thresholdIndex,
  thresholdLabels,
} from './thresholdScale.ts'

const cuts = numericDomain(['0.2', '0.4', '0.6', '0.8'])

test('a value takes the bin of the cut points it is at or past', () => {
  expect(
    [0, 0.1, 0.2, 0.39, 0.4, 0.75, 0.8, 1].map(v => thresholdIndex(v, cuts)),
  ).toEqual([0, 0, 1, 1, 2, 3, 4, 4])
})

test('a string value reads as its number, anything else as no bin', () => {
  expect(thresholdIndex('0.5', cuts)).toBe(2)
  expect(thresholdIndex(undefined, cuts)).toBe(-1)
  expect(thresholdIndex(Number.NaN, cuts)).toBe(-1)
  expect(thresholdIndex('high', cuts)).toBe(-1)
})

test('an empty domain is one bin', () => {
  expect(thresholdIndex(7, [])).toBe(0)
  expect(thresholdLabels([])).toEqual(['any value'])
})

test('a label per palette entry, bounded by its cut points', () => {
  expect(thresholdLabels(cuts)).toEqual([
    '< 0.2',
    '0.2 – 0.4',
    '0.4 – 0.6',
    '0.6 – 0.8',
    '≥ 0.8',
  ])
  expect(thresholdLabels([5])).toEqual(['< 5', '≥ 5'])
})

describe('thresholdField', () => {
  const field = thresholdField('dif', {
    domain: ['0', '-0.3', '0.3'],
    range: ['blue', 'lightblue', 'pink', 'red'],
  })

  test('files a value under its bin, a cut taking the bin above it', () => {
    expect(['-0.5', -0.3, '-0.1', 0, '0.3', 0.9].map(field.key)).toEqual([
      '< -0.3',
      '-0.3 – 0',
      '-0.3 – 0',
      '0 – 0.3',
      '≥ 0.3',
      '≥ 0.3',
    ])
  })

  test('paints each bin its range colour in ascending cut order', () => {
    expect(field.domain.map(field.color)).toEqual([
      'blue',
      'lightblue',
      'pink',
      'red',
    ])
  })

  test('tells a missing value from text that is no number', () => {
    expect([undefined, '', [undefined], [null]].map(field.key)).toEqual([
      '',
      '',
      '',
      '',
    ])
    expect(field.key('NA')).toBe(NOT_A_NUMBER_LABEL)
    expect(field.color('')).toBe(NO_CATEGORY_COLOR)
    expect(field.color(NOT_A_NUMBER_LABEL)).toBe(MISCONFIGURED_COLOR)
    expect(field.label('')).toBe(NO_VALUE_LABEL)
  })

  test('orders the bins, then text that is no number, then no value', () => {
    expect(
      ['', NOT_A_NUMBER_LABEL, '≥ 0.3', '< -0.3'].toSorted(field.compare),
    ).toEqual(['< -0.3', '≥ 0.3', NOT_A_NUMBER_LABEL, ''])
  })

  test('its domain is closed, so a key lists every bin', () => {
    expect(field.closed).toBe(true)
  })
})
