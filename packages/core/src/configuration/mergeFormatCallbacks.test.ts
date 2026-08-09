import { mergeFormatCallbacks } from './mergeFormatCallbacks.ts'

test('later tiers override earlier ones key by key', () => {
  expect(
    mergeFormatCallbacks(
      { a: 'session', b: 'session' },
      { b: 'track', c: 'track' },
    ),
  ).toEqual({ a: 'session', b: 'track', c: 'track' })
})

test('an absent tier contributes nothing', () => {
  expect(mergeFormatCallbacks(undefined, { a: 1 }, undefined)).toEqual({ a: 1 })
})

// `"jexl:feature.name"` where `"jexl:{name:feature.name}"` was meant. Spread,
// the string became attribute rows keyed 0, 1, 2
test('a string tier is dropped rather than spread character by character', () => {
  expect(mergeFormatCallbacks('gene1', { a: 1 })).toEqual({ a: 1 })
})

test('an array tier is dropped rather than spread by index', () => {
  expect(mergeFormatCallbacks(['x', 'y'])).toEqual({})
})

// null and undefined values are how a callback hides a field, so they have to
// survive the merge -- the panel filters them out downstream
test('null and undefined values are kept', () => {
  const merged = mergeFormatCallbacks({ hidden: null, alsoHidden: undefined })
  expect('hidden' in merged).toBe(true)
  expect('alsoHidden' in merged).toBe(true)
})

test('no tiers is an empty object, not undefined', () => {
  expect(mergeFormatCallbacks()).toEqual({})
})
