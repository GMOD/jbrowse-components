import { visibleSamples } from './visibleSamples.ts'

test('a focus naming a listed species ships that set', () => {
  expect(visibleSamples(['mm10', 'rn6'])).toEqual(new Set(['mm10', 'rn6']))
})

// The display draws no row for such a focus and says so, so the worker ships
// none either: it no longer falls back to every species.
test('a focus naming no listed species ships that set, which matches no row', () => {
  expect(visibleSamples(['rn6'])).toEqual(new Set(['rn6']))
})

// The display draws only `hg38~2` for such a focus, and `isRowVisible` ships a
// copy row by its own name.
test('a focus naming a copy of a listed species ships that set', () => {
  expect(visibleSamples(['hg38~2'])).toEqual(new Set(['hg38~2']))
})

test('a focus naming a copy of an unlisted species ships that set', () => {
  expect(visibleSamples(['rn6~2'])).toEqual(new Set(['rn6~2']))
})

test('no focus ships every species', () => {
  expect(visibleSamples(undefined)).toBeUndefined()
  expect(visibleSamples([])).toBeUndefined()
})
