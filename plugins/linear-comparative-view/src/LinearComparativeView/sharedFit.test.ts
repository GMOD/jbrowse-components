import { sharedFit } from './sharedFit.ts'

const row = (fitBpPerPx: number, initialized = true) => ({
  fitBpPerPx,
  initialized,
})

test('the coarsest row fit is the one every row shares', () => {
  expect(sharedFit([row(22), row(222)], true)).toEqual({
    answered: true,
    bpPerPx: 222,
  })
})

test('the mode off is a definite zero, not an absent answer', () => {
  expect(sharedFit([row(22), row(222)], false)).toEqual({
    answered: true,
    bpPerPx: 0,
  })
})

// -Infinity as a zoom-out ceiling is a row that can never zoom out
test('an empty stack has no answer rather than answering -Infinity', () => {
  expect(sharedFit([], true)).toEqual({ answered: false })
})

// reading fitBpPerPx off an unmeasured row throws
test('a row that cannot answer yet holds the whole stack off', () => {
  expect(sharedFit([row(22), row(222, false)], true)).toEqual({
    answered: false,
  })
  expect(sharedFit([row(22, false), row(222)], true)).toEqual({
    answered: false,
  })
})

// the distinction the union exists for: both of these once collapsed onto 0,
// and a caller cannot tell "release the rows" from "ask again in a moment"
test('mode off and not-yet-measured are different answers', () => {
  expect(sharedFit([row(22, false)], false)).not.toEqual(
    sharedFit([row(22, false)], true),
  )
})
