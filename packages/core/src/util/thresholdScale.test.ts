import {
  numericDomain,
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
