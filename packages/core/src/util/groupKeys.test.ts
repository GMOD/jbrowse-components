import {
  MAX_GROUPS,
  OVERFLOW_GROUP_KEY,
  capGroupKeys,
  carryGroupDomain,
  compareGroupKeys,
  groupKeyComparator,
  groupKeySpaceOf,
  valueText,
} from './groupKeys.ts'

test('a missing value is the catch-all and a list joins', () => {
  expect(valueText(undefined)).toBe('')
  expect(valueText(null)).toBe('')
  expect(valueText(['a', 2])).toBe('a,2')
  expect(valueText(0)).toBe('0')
})

test('a domain places the keys it lists first, and the rest sort behind them', () => {
  const keys = ['10', 'key2', '', 'key5', '2', 'key3']
  expect([...keys].sort(groupKeyComparator(['key5', 'key2', 'key3']))).toEqual([
    'key5',
    'key2',
    'key3',
    '2',
    '10',
    '',
  ])
  expect([...keys].sort(groupKeyComparator([]))).toEqual([
    '2',
    '10',
    'key2',
    'key3',
    'key5',
    '',
  ])
})

test('a listed key the data lacks places nothing, and a repeat keeps its first place', () => {
  expect(['b', 'a'].sort(groupKeyComparator(['z', 'b', 'a', 'b']))).toEqual([
    'b',
    'a',
  ])
})

test('a domain can place the catch-all and the overflow bucket ahead of named keys', () => {
  expect(
    ['a', OVERFLOW_GROUP_KEY, ''].sort(
      groupKeyComparator(['', OVERFLOW_GROUP_KEY]),
    ),
  ).toEqual(['', OVERFLOW_GROUP_KEY, 'a'])
})

test('the cap keeps the first keys in natural order and merges the tail', () => {
  const keys = Array.from({ length: MAX_GROUPS + 5 }, (_, i) => `v${i}`)
  const { sectionOf, mergedCount } = capGroupKeys(keys.toReversed())
  expect(sectionOf('v0')).toBe('v0')
  expect(sectionOf(`v${MAX_GROUPS - 2}`)).toBe(`v${MAX_GROUPS - 2}`)
  expect(sectionOf(`v${MAX_GROUPS - 1}`)).toBe(OVERFLOW_GROUP_KEY)
  expect(mergedCount).toBe(6)
})

test('the catch-all stays out of the merge', () => {
  const keys = [
    '',
    ...Array.from({ length: MAX_GROUPS + 5 }, (_, i) => `v${i}`),
  ]
  const { sectionOf } = capGroupKeys(keys)
  expect(sectionOf('')).toBe('')
  expect(sectionOf('v0')).toBe('v0')
  expect(sectionOf(`v${MAX_GROUPS}`)).toBe(OVERFLOW_GROUP_KEY)
})

test('the key space is the field, never the domain', () => {
  const plain = groupKeySpaceOf({ field: 'biotype' })
  expect(groupKeySpaceOf({ field: 'biotype', domain: ['lncRNA'] })).toBe(plain)
  expect(groupKeySpaceOf({ field: 'gene_type' })).not.toBe(plain)
  expect(groupKeySpaceOf(undefined)).toBe('')
})

test('a digit run inside a key compares by magnitude, so chr2 files before chr10', () => {
  expect(
    ['chr10', 'chr2', 'chr1', 'chrX', 'HP10', 'HP2', 'HP1b', 'HP1a'].sort(
      compareGroupKeys,
    ),
  ).toEqual(['HP1a', 'HP1b', 'HP2', 'HP10', 'chr1', 'chr2', 'chr10', 'chrX'])
  expect(['v01', 'v1'].sort(compareGroupKeys)).toEqual(['v1', 'v01'])
})

test('numbers sort first by value, then every other key', () => {
  expect(['1', '-1', '0.5', '-', '+'].sort(compareGroupKeys)).toEqual([
    '-1',
    '0.5',
    '1',
    '+',
    '-',
  ])
})

test('the order is transitive, so every input order sorts the same', () => {
  const keys = ['-2', '-5x', '-10', '1.5', '1.7x', '1.10', 'a', '']
  const permutations = (xs: string[]): string[][] =>
    xs.length <= 1
      ? [xs]
      : xs.flatMap((x, i) =>
          permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [
            x,
            ...p,
          ]),
        )
  const sorted = new Set(
    permutations(keys).map(p => p.sort(compareGroupKeys).join('|')),
  )
  expect([...sorted]).toEqual(['-10|-2|1.10|1.5|-5x|1.7x|a|'])
})

test('a re-pick of the same field keeps the domain; a reorder or a new field does not', () => {
  const current: { field: string; domain?: string[] } = {
    field: 'biotype',
    domain: ['lncRNA'],
  }
  expect(carryGroupDomain({ field: 'biotype' }, current)).toEqual(current)
  expect(carryGroupDomain({ field: 'biotype', domain: [] }, current)).toEqual({
    field: 'biotype',
    domain: [],
  })
  expect(carryGroupDomain({ field: 'gene_type' }, current)).toEqual({
    field: 'gene_type',
  })
  expect(carryGroupDomain(undefined, current)).toBeUndefined()
  expect(carryGroupDomain({ field: 'biotype' }, undefined)).toEqual({
    field: 'biotype',
  })
})
