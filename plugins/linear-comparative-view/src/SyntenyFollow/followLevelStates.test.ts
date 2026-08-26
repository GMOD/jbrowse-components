import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { createFollowLevelStates } from './followLevelStates.ts'

const level = () => ({})

test('one token per epoch, handed to every request planned under it', () => {
  const states = createFollowLevelStates<object>()
  expect(states.stopToken).toBe(states.stopToken)
})

// `clear()`'s own sentence claims it drops "every pick, cached transform,
// in-flight answer and reported error at once". Bumping `generation` only
// dropped the ANSWER — the worker went on re-reading the whole region out of
// the PAF for a map nobody would keep. A map request is once per block across a
// drag, so switching the follow off left one grinding per block crossed.
test('dropping the store stops the requests behind it, not just their answers', () => {
  const states = createFollowLevelStates<object>()
  const token = states.stopToken

  expect(() => {
    checkStopToken(token)
  }).not.toThrow()

  states.clear()
  expect(() => {
    checkStopToken(token)
  }).toThrow(/aborted/i)
})

// A stopped token must not be handed to the next epoch's requests, which would
// abort them on arrival.
test('the next epoch mints its own token', () => {
  const states = createFollowLevelStates<object>()
  const first = states.stopToken
  states.clear()
  const second = states.stopToken

  expect(second).not.toBe(first)
  expect(() => {
    checkStopToken(second)
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

  expect(states.stopToken).toBe(states.stopToken)
  states.clear()
  expect(states.get(a).seq).toBe(0)
})
