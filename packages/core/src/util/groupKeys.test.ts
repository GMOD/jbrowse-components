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

test('the cap counts in domain order, so a placed key never merges behind an unplaced one', () => {
  const keys = Array.from(
    { length: MAX_GROUPS + 5 },
    (_, i) => `v${String(i).padStart(3, '0')}`,
  )
  const last = keys.at(-1)!
  const { sectionOf, mergedCount } = capGroupKeys(keys, [last])
  expect(sectionOf(last)).toBe(last)
  expect(sectionOf('v000')).toBe('v000')
  expect(sectionOf(`v0${MAX_GROUPS - 2}`)).toBe(OVERFLOW_GROUP_KEY)
  expect(mergedCount).toBe(6)
})

test('the catch-all stays out of the merge wherever the domain places it', () => {
  const keys = [
    '',
    ...Array.from({ length: MAX_GROUPS + 5 }, (_, i) => `v${i}`),
  ]
  const { sectionOf } = capGroupKeys(keys, [''])
  expect(sectionOf('')).toBe('')
  expect(sectionOf('v0')).toBe('v0')
})

test('the key space is the dimension and its parameter, never the domain', () => {
  const plain = groupKeySpaceOf({ type: 'attribute', attribute: 'biotype' })
  expect(
    groupKeySpaceOf({
      type: 'attribute',
      attribute: 'biotype',
      domain: ['lncRNA'],
    }),
  ).toBe(plain)
  expect(
    groupKeySpaceOf({ type: 'attribute', attribute: 'gene_type' }),
  ).not.toBe(plain)
})

test('a digit run inside a key compares by magnitude, so chr2 files before chr10', () => {
  expect(
    ['chr10', 'chr2', 'chr1', 'chrX', 'HP10', 'HP2', 'HP1b', 'HP1a'].sort(
      compareGroupKeys,
    ),
  ).toEqual(['HP1a', 'HP1b', 'HP2', 'HP10', 'chr1', 'chr2', 'chr10', 'chrX'])
  expect(['v01', 'v1'].sort(compareGroupKeys)).toEqual(['v1', 'v01'])
})

test('a signed or decimal key compares by magnitude, and a bare sign does not', () => {
  expect(['1', '-1', '0.5', '-', '+'].sort(compareGroupKeys)).toEqual([
    '+',
    '-',
    '-1',
    '0.5',
    '1',
  ])
})

test('a re-pick in the same key space keeps the domain; a reorder or a new space does not', () => {
  const current: { type: string; attribute: string; domain?: string[] } = {
    type: 'attribute',
    attribute: 'biotype',
    domain: ['lncRNA'],
  }
  expect(
    carryGroupDomain({ type: 'attribute', attribute: 'biotype' }, current),
  ).toEqual(current)
  expect(
    carryGroupDomain(
      { type: 'attribute', attribute: 'biotype', domain: [] },
      current,
    ),
  ).toEqual({ type: 'attribute', attribute: 'biotype', domain: [] })
  expect(
    carryGroupDomain({ type: 'attribute', attribute: 'gene_type' }, current),
  ).toEqual({ type: 'attribute', attribute: 'gene_type' })
  expect(carryGroupDomain(undefined, current)).toBeUndefined()
  expect(
    carryGroupDomain({ type: 'attribute', attribute: 'biotype' }, undefined),
  ).toEqual({ type: 'attribute', attribute: 'biotype' })
})
