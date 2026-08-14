import { makeStringDict } from './stringDict.ts'

test('interns a value to a stable id', () => {
  const d = makeStringDict()
  expect(d.idFor('chr1')).toBe(0)
  expect(d.idFor('chr2')).toBe(1)
  expect(d.idFor('chr1')).toBe(0)
  expect(d.dict).toEqual(['chr1', 'chr2'])
})

// The lane a PAF produces: no feature has a name, so every id is 0 and the
// dictionary is one empty string. A zero-filled Uint32Array is the cheapest
// thing the RPC boundary can carry, which is the whole point of encoding a lane
// nothing fills.
test('an absent value is a value', () => {
  const d = makeStringDict()
  expect(d.idFor('')).toBe(0)
  expect(d.idFor('')).toBe(0)
  expect(d.dict).toEqual([''])
})

// `dict` is the array the payload ships, so it has to be the live one rather
// than a copy taken at construction.
test('dict grows as values arrive', () => {
  const d = makeStringDict()
  const { dict } = d
  d.idFor('a')
  d.idFor('b')
  expect(dict).toEqual(['a', 'b'])
})

// Reading a lane back is `dict[ids[i]]`, and a consumer filtering on a name
// resolves it to an id once with `indexOf` — which answers -1 for a name the
// dictionary does not hold, matching no feature. Both readings are pinned here
// because they are what every consumer of an encoded lane does.
test('a name the dictionary lacks resolves to no id', () => {
  const d = makeStringDict()
  d.idFor('chr1')
  expect(d.dict.indexOf('chr1')).toBe(0)
  expect(d.dict.indexOf('chrZ')).toBe(-1)
})
