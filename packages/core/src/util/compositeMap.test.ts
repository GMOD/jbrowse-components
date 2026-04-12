import CompositeMap from './compositeMap.ts'

function makeMap<K, V>(entries: [K, V][]) {
  return new Map(entries)
}

test('has and get defer to first submap containing the key', () => {
  const a = makeMap([['x', 1]])
  const b = makeMap([['x', 99], ['y', 2]])
  const cm = new CompositeMap([a, b])
  expect(cm.has('x')).toBe(true)
  expect(cm.has('y')).toBe(true)
  expect(cm.has('z')).toBe(false)
  // first submap wins
  expect(cm.get('x')).toBe(1)
  expect(cm.get('y')).toBe(2)
})

test('keys yields each key once even when duplicated across submaps', () => {
  const a = makeMap([['x', 1], ['y', 2]])
  const b = makeMap([['y', 99], ['z', 3]])
  const cm = new CompositeMap([a, b])
  expect([...cm.keys()]).toEqual(['x', 'y', 'z'])
})

test('values yields the first-submap value for duplicate keys', () => {
  const a = makeMap([['x', 1], ['y', 2]])
  const b = makeMap([['y', 99], ['z', 3]])
  const cm = new CompositeMap([a, b])
  expect([...cm.values()]).toEqual([1, 2, 3])
})

test('entries yields [key, first-submap-value] pairs without duplicates', () => {
  const a = makeMap<string, number>([['x', 1]])
  const b = makeMap<string, number>([['x', 99], ['y', 2]])
  const cm = new CompositeMap([a, b])
  expect([...cm.entries()]).toEqual([['x', 1], ['y', 2]])
})

test('[Symbol.iterator] matches entries', () => {
  const a = makeMap<string, number>([['a', 10]])
  const b = makeMap<string, number>([['b', 20]])
  const cm = new CompositeMap([a, b])
  expect([...cm]).toEqual([...cm.entries()])
})

test('find returns first matching value across all submaps', () => {
  const a = makeMap([['x', 1]])
  const b = makeMap([['y', 2], ['z', 3]])
  const cm = new CompositeMap([a, b])
  expect(cm.find(v => v > 1)).toBe(2)
  expect(cm.find(v => v > 100)).toBeUndefined()
})

test('works with empty submaps array', () => {
  const cm = new CompositeMap<string, number>([])
  expect(cm.has('x')).toBe(false)
  expect(cm.get('x')).toBeUndefined()
  expect([...cm.keys()]).toEqual([])
  expect([...cm.values()]).toEqual([])
  expect([...cm.entries()]).toEqual([])
})
