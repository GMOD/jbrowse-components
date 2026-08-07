import { types } from '@jbrowse/mobx-state-tree'

import { isUsableValue } from './slotShape.ts'

import type { ConfigSlotDefinition } from './configurationSlot.ts'

// The premise `matchesSlotShape` is built on. It hand-writes per-type shape
// checks instead of delegating to the slot's own MST `model.is(value)`, and
// these two are the reason — both are values no slot should accept and both
// pass MST's check. If either ever became `false` upstream, the hand-written
// checks would be redundant and nothing else in the repo would say so.
test('MST type.is is too permissive to be the shape gate', () => {
  expect(types.number.is(NaN)).toBe(true)
  expect(types.frozen().is('any-string')).toBe(true)
})

// `isUsableValue` is what the cascade calls on both tiers (a session-wide
// promoted default and a track's own saved value), and what `ConfigSlot` calls
// on `promotedBase` at construction. Exercised directly here; the cascade's own
// tests reach it only through a resolution.
describe('isUsableValue', () => {
  const numberSlot: ConfigSlotDefinition = {
    type: 'maybeNumber',
    defaultValue: undefined,
    promotedBase: 5,
  }

  test('being unset is the inherit sentinel, never a usable value', () => {
    expect(isUsableValue(numberSlot, undefined)).toBe(false)
    expect(isUsableValue(numberSlot, 3)).toBe(true)
  })

  test('a non-finite number is refused', () => {
    // the case types.number.is admits, above
    expect(isUsableValue(numberSlot, NaN)).toBe(false)
    expect(isUsableValue(numberSlot, Infinity)).toBe(false)
  })

  // Nothing in the app can author a callback on a promotable slot, but a
  // hand-edited config or default store is untyped, and a `jexl:` string would
  // otherwise sail through a string-shaped slot and reach a renderer as a
  // literal color. This is the only place the subsystem handles a callback, and
  // it handles it by refusing it.
  test('a jexl callback string is refused rather than evaluated', () => {
    const colorSlot: ConfigSlotDefinition = {
      type: 'maybeColor',
      defaultValue: undefined,
      promotedBase: 'goldenrod',
    }
    expect(isUsableValue(colorSlot, 'jexl:"red"')).toBe(false)
    expect(isUsableValue(colorSlot, 'red')).toBe(true)
  })

  test('a stale enum member is refused against the slot vocabulary', () => {
    const enumSlot: ConfigSlotDefinition = {
      type: 'maybeStringEnum',
      model: types.enumeration('ShapeMode', ['normal', 'compact']),
      defaultValue: undefined,
      promotedBase: 'normal',
    }
    expect(isUsableValue(enumSlot, 'compact')).toBe(true)
    // a value saved before the scheme was renamed away
    expect(isUsableValue(enumSlot, 'superCompact')).toBe(false)
  })

  test('the validate hook layers semantics over the shape check', () => {
    const validated: ConfigSlotDefinition = {
      type: 'maybeFrozen',
      defaultValue: undefined,
      promotedBase: { type: 'strand' },
      validate: value =>
        typeof value === 'object' &&
        value !== null &&
        (value as { type?: unknown }).type === 'strand',
    }
    expect(isUsableValue(validated, { type: 'strand' })).toBe(true)
    // right shape, but names a scheme no longer registered
    expect(isUsableValue(validated, { type: 'sinceRemoved' })).toBe(false)
  })
})
