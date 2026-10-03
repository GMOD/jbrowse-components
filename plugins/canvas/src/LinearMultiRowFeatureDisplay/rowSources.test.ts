import { orderRowValues } from './rowSources.ts'

test('empty domain = sorted', () => {
  expect(orderRowValues(new Set(['c', 'a', 'b']), [])).toEqual(['a', 'b', 'c'])
})

test('domain values come first in order, rest sorted', () => {
  expect(orderRowValues(new Set(['c', 'a', 'b', 'd']), ['d', 'b'])).toEqual([
    'd',
    'b',
    'a',
    'c',
  ])
})

test('domain entries not present in data are skipped', () => {
  expect(orderRowValues(new Set(['a', 'b']), ['z', 'b'])).toEqual(['b', 'a'])
})

test('duplicate domain entries are de-duplicated (no blank row)', () => {
  expect(orderRowValues(new Set(['a', 'b']), ['a', 'a', 'b'])).toEqual([
    'a',
    'b',
  ])
})

test('numeric partition values sort numerically, not lexicographically', () => {
  // A chromHMM state column: plain string order files 10 and 11 between 1 and
  // 2.
  expect(
    orderRowValues(new Set(['10', '2', '1', '20', '11', '3']), []),
  ).toEqual(['1', '2', '3', '10', '11', '20'])
})

test('a mixed numeric/text partition column still orders every value', () => {
  expect(orderRowValues(new Set(['10', 'Quies', '2', 'TssA']), [])).toEqual([
    '2',
    '10',
    'Quies',
    'TssA',
  ])
})

test('the features carrying no value file last, after every real value', () => {
  expect(orderRowValues(new Set(['', 'b', '10', 'a']), [])).toEqual([
    '10',
    'a',
    'b',
    '',
  ])
})

test('domain may still pin the empty value where it says', () => {
  expect(orderRowValues(new Set(['', 'a']), ['', 'a'])).toEqual(['', 'a'])
})
