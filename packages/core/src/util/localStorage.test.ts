import {
  localStorageGetBoolean,
  localStorageGetItem,
  localStorageGetJSON,
  localStorageGetNumber,
  localStorageRemoveItem,
  localStorageSetItem,
} from './localStorage.ts'

beforeEach(() => {
  localStorage.clear()
  jest.restoreAllMocks()
})

test('a missing key reads as undefined, not null', () => {
  expect(localStorageGetItem('nope')).toBeUndefined()
})

test('a write that throws does not propagate, and warns once', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('quota', 'QuotaExceededError')
  })
  expect(() => {
    localStorageSetItem('a', '1')
    localStorageSetItem('b', '2')
  }).not.toThrow()
  // the second failure is silent: these run from autoruns that re-fire on every
  // settings change
  expect(warn).toHaveBeenCalledTimes(1)
})

test('a read that throws falls back rather than propagating', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError')
  })
  expect(localStorageGetItem('a')).toBeUndefined()
  expect(localStorageGetNumber('a', 42)).toBe(42)
  expect(localStorageGetBoolean('a', true)).toBe(true)
})

// The guards make a failed write indistinguishable from a successful one,
// which is right for the autoruns that persist settings and wrong for anything
// that reads the key back to learn the current value: it would read its own
// default and report it as what is stored.
test('a write reports whether the store took it', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  expect(localStorageSetItem('a', '1')).toBe(true)
  expect(localStorageRemoveItem('a')).toBe(true)
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('quota', 'QuotaExceededError')
  })
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError')
  })
  expect(localStorageSetItem('a', '1')).toBe(false)
  expect(localStorageRemoveItem('a')).toBe(false)
  // warn is stubbed rather than asserted on: `warnedOnWrite` is a module-level
  // latch, so whether the line lands here depends on test order
  expect(warn).toBeDefined()
})

test('remove is guarded the same way', () => {
  localStorageSetItem('a', '1')
  localStorageRemoveItem('a')
  expect(localStorageGetItem('a')).toBeUndefined()
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError')
  })
  expect(() => {
    localStorageRemoveItem('a')
  }).not.toThrow()
})

describe('localStorageGetNumber', () => {
  test('reads a stored number', () => {
    localStorageSetItem('n', '12')
    expect(localStorageGetNumber('n', 5)).toBe(12)
  })
  test('an empty entry falls back instead of coercing to 0', () => {
    localStorageSetItem('n', '')
    expect(localStorageGetNumber('n', 400)).toBe(400)
  })
  test('a non-numeric entry falls back', () => {
    localStorageSetItem('n', 'wide')
    expect(localStorageGetNumber('n', 400)).toBe(400)
  })
  test('Infinity falls back', () => {
    localStorageSetItem('n', 'Infinity')
    expect(localStorageGetNumber('n', 400)).toBe(400)
  })
})

describe('localStorageGetBoolean', () => {
  test('round-trips both booleans', () => {
    localStorageSetItem('b', 'true')
    expect(localStorageGetBoolean('b', false)).toBe(true)
    localStorageSetItem('b', 'false')
    expect(localStorageGetBoolean('b', true)).toBe(false)
  })
  test('a non-boolean entry keeps the default rather than coercing', () => {
    localStorageSetItem('b', 'null')
    expect(localStorageGetBoolean('b', true)).toBe(true)
    localStorageSetItem('b', '0')
    expect(localStorageGetBoolean('b', true)).toBe(true)
  })
})

test('localStorageGetJSON falls back on malformed JSON', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  localStorageSetItem('j', '{oops')
  expect(localStorageGetJSON('j', { a: 1 })).toEqual({ a: 1 })
  expect(warn).toHaveBeenCalled()
})
