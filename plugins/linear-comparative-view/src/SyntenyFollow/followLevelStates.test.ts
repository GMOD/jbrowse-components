import { checkAbortSignal } from '@jbrowse/core/util/aborting'

import { createFollowLevelStates } from './followLevelStates.ts'

const level = () => ({})

test('one signal per epoch, handed to every request planned under it', () => {
  const states = createFollowLevelStates<object>()
  expect(states.signal).toBe(states.signal)
})

// Bumping `generation` alone drops only the ANSWER: the worker goes on
// re-reading the whole region out of the PAF for a map nobody will keep, once
// per block crossed during a drag.
test('dropping the store stops the requests behind it, not just their answers', () => {
  const states = createFollowLevelStates<object>()
  const signal = states.signal

  expect(() => {
    checkAbortSignal(signal)
  }).not.toThrow()

  states.clear()
  expect(() => {
    checkAbortSignal(signal)
  }).toThrow(/aborted/i)
})

// An aborted signal handed to the next epoch's requests would abort them on
// arrival.
test('the next epoch creates its own signal', () => {
  const states = createFollowLevelStates<object>()
  const first = states.signal
  states.clear()
  const second = states.signal

  expect(second).not.toBe(first)
  expect(() => {
    checkAbortSignal(second)
  }).not.toThrow()
})

// The signal is epoch-scoped rather than per level or per request: a later
// window inside the same block still wants the map already in flight for it,
// which is why this cannot be a latest-wins rotation.
test('every level of one epoch shares the signal', () => {
  const states = createFollowLevelStates<object>()
  const a = level()
  const b = level()
  states.get(a)
  states.get(b)

  expect(states.signal).toBe(states.signal)
  states.clear()
  expect(states.get(a).seq).toBe(0)
})

// A pick and a spread were made on one axis. Handed across a flip of the
// follow's direction they became the next plan's incumbents on the other: the
// block id, the target contig the vote leans toward, and the hysteresis.
test('a flip of direction drops the decisions made facing the other way', () => {
  const states = createFollowLevelStates<object>()
  const a = level()
  const forward = states.facing(a, true)
  forward.pick = { feat: {}, target: 'chr9' } as NonNullable<
    typeof forward.pick
  >
  forward.spread = { spreading: true }
  forward.seq = 3
  expect(states.peek(a, true)?.pick?.target).toBe('chr9')
  expect(states.peek(a, false)).toBeUndefined()

  const back = states.facing(a, false)
  expect(back.pick).toBeUndefined()
  expect(back.spread).toBeUndefined()
  expect(back.seq).toBe(3)
  expect(states.peek(a, true)).toBeUndefined()
})
