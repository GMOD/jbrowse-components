import { checkAbortSignal } from '@jbrowse/core/util/aborting'

import { createFollowLevelStates } from './followLevelStates.ts'

const level = () => ({})

test('one token per epoch, handed to every request planned under it', () => {
  const states = createFollowLevelStates<object>()
  expect(states.signal).toBe(states.signal)
})

// `clear()`'s own sentence claims it drops "every pick, cached transform,
// in-flight answer and reported error at once". Bumping `generation` only
// dropped the ANSWER — the worker went on re-reading the whole region out of
// the PAF for a map nobody would keep. A map request is once per block across a
// drag, so switching the follow off left one grinding per block crossed.
test('dropping the store stops the requests behind it, not just their answers', () => {
  const states = createFollowLevelStates<object>()
  const token = states.signal

  expect(() => {
    checkAbortSignal(token)
  }).not.toThrow()

  states.clear()
  expect(() => {
    checkAbortSignal(token)
  }).toThrow(/aborted/i)
})

// A stopped token must not be handed to the next epoch's requests, which would
// abort them on arrival.
test('the next epoch mints its own token', () => {
  const states = createFollowLevelStates<object>()
  const first = states.signal
  states.clear()
  const second = states.signal

  expect(second).not.toBe(first)
  expect(() => {
    checkAbortSignal(second)
  }).not.toThrow()
})

// The token is epoch-scoped rather than per level or per request: a later window
// inside the same block still wants the map already in flight for it, which is
// why this cannot be a latest-wins rotation.
test('every level of one epoch shares the token', () => {
  const states = createFollowLevelStates<object>()
  const a = level()
  const b = level()
  states.get(a)
  states.get(b)

  expect(states.signal).toBe(states.signal)
  states.clear()
  expect(states.get(a).seq).toBe(0)
})
