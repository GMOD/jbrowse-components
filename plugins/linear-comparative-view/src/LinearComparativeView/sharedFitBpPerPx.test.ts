import { sharedFitBpPerPx } from './sharedFitBpPerPx.ts'

const row = (fitBpPerPx: number, initialized = true) => ({
  fitBpPerPx,
  initialized,
})

test('the coarsest row fit is the one every row shares', () => {
  expect(sharedFitBpPerPx([row(22), row(222)], true)).toBe(222)
})

test('the mode off is no shared ceiling at all', () => {
  expect(sharedFitBpPerPx([row(22), row(222)], false)).toBe(0)
})

// -Infinity as a zoom-out ceiling is a row that can never zoom out
test('an empty stack answers zero, not -Infinity', () => {
  expect(sharedFitBpPerPx([], true)).toBe(0)
})

// reading fitBpPerPx off an unmeasured row throws, and this is read from an
// autorun that runs before the first layout
test('a row that cannot answer yet holds the whole stack off', () => {
  expect(sharedFitBpPerPx([row(22), row(222, false)], true)).toBe(0)
  expect(sharedFitBpPerPx([row(22, false), row(222)], true)).toBe(0)
})
