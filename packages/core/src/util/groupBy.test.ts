import { groupBy } from './index.ts'

// Keys are data — a BAM QNAME, a bedGraph source column, a track category — so
// a read named `constructor` is a bucket, not Object's constructor. On a plain
// `{}` accumulator `result[t] ??= []` finds the inherited value, declines to
// assign, and the push throws.
test.each([
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
  '__proto__',
])('groups a key named %s', key => {
  expect(groupBy([{ k: key }], v => v.k)).toEqual({ [key]: [{ k: key }] })
})

test('groups ordinary keys', () => {
  expect(groupBy([1, 2, 3, 4], n => (n % 2 ? 'odd' : 'even'))).toEqual({
    odd: [1, 3],
    even: [2, 4],
  })
})

// Object.entries/values/keys are how every caller reads the result, and a
// null-prototype object still answers all three.
test('the result is enumerable the way callers read it', () => {
  const grouped = groupBy(['a', 'bb', 'c'], s => String(s.length))
  expect(Object.keys(grouped)).toEqual(['1', '2'])
  expect(Object.values(grouped)).toEqual([['a', 'c'], ['bb']])
  expect(Object.entries(grouped)).toHaveLength(2)
})
