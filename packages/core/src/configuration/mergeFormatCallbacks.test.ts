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
// the string became attribute rows keyed 0, 1, 2; dropped, it did nothing
test('a string tier is an error naming the mistake', () => {
  expect(() => mergeFormatCallbacks('gene1', { a: 1 })).toThrow(
    'returned a string',
  )
})

test('an array tier is an error', () => {
  expect(() => mergeFormatCallbacks(['x', 'y'])).toThrow('returned an array')
})

test('a tier returning null has nothing to add', () => {
  expect(mergeFormatCallbacks(null, { a: 1 })).toEqual({ a: 1 })
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
