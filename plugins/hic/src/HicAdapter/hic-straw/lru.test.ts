import LRU from './lru.ts'

const weigh = (v: { bytes: number }) => v.bytes

test('evicts the oldest entry at the entry cap', () => {
  const lru = new LRU<string, number>(2)
  lru.set('a', 1)
  lru.set('b', 2)
  lru.set('c', 3)
  expect(lru.get('a')).toBeUndefined()
  expect(lru.get('b')).toBe(2)
  expect(lru.get('c')).toBe(3)
})

test('a get refreshes an entry so it outlives an older one', () => {
  const lru = new LRU<string, number>(2)
  lru.set('a', 1)
  lru.set('b', 2)
  lru.get('a')
  lru.set('c', 3)
  expect(lru.get('a')).toBe(1)
  expect(lru.get('b')).toBeUndefined()
})

test('the byte budget evicts before the entry cap is reached', () => {
  const lru = new LRU<string, { bytes: number }>(100, { maxBytes: 10, weigh })
  lru.set('a', { bytes: 6 })
  lru.set('b', { bytes: 3 })
  // 6 + 3 + 4 = 13 > 10, so the oldest goes and 3 + 4 fits — with two of a
  // hundred entry slots still free, which is the point
  lru.set('c', { bytes: 4 })
  expect(lru.get('a')).toBeUndefined()
  expect(lru.get('b')).toBeDefined()
  expect(lru.get('c')).toBeDefined()
})

// Weight has to be released on both paths that drop a value, or the cache
// shrinks toward holding nothing while reporting a budget it is nowhere near.
test('replacing a key releases the old value weight', () => {
  const lru = new LRU<string, { bytes: number }>(100, { maxBytes: 10, weigh })
  for (let i = 0; i < 20; i++) {
    lru.set('a', { bytes: 8 })
  }
  lru.set('b', { bytes: 2 })
  expect(lru.get('a')).toBeDefined()
  expect(lru.get('b')).toBeDefined()
})

test('delete releases weight', () => {
  const lru = new LRU<string, { bytes: number }>(100, { maxBytes: 10, weigh })
  lru.set('a', { bytes: 9 })
  lru.delete('a')
  lru.set('b', { bytes: 9 })
  lru.set('c', { bytes: 1 })
  expect(lru.get('b')).toBeDefined()
  expect(lru.get('c')).toBeDefined()
})

// A cache that cannot hold what it was just handed should still answer the
// caller that handed it over, rather than evicting to empty and looping.
test('an entry larger than the whole budget is retained', () => {
  const lru = new LRU<string, { bytes: number }>(100, { maxBytes: 10, weigh })
  lru.set('a', { bytes: 5 })
  lru.set('big', { bytes: 999 })
  expect(lru.get('big')).toBeDefined()
  expect(lru.get('a')).toBeUndefined()
})

test('without weight options the cache is entry-capped only', () => {
  const lru = new LRU<string, { bytes: number }>(2)
  lru.set('a', { bytes: 1e9 })
  lru.set('b', { bytes: 1e9 })
  expect(lru.get('a')).toBeDefined()
  expect(lru.get('b')).toBeDefined()
})
