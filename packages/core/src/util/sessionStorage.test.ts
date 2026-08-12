import {
  sessionStorageGetItem,
  sessionStorageRemoveItem,
  sessionStorageSetItem,
} from './sessionStorage.ts'

// The guard itself is exercised through the localStorage face
// (localStorage.test.ts); what is worth pinning here is that this face is wired
// to the OTHER store. The two are one implementation, so a mixed-up global
// would look correct in every test that only ever reads back what it wrote.
beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

test('reads and writes sessionStorage, not localStorage', () => {
  expect(sessionStorageSetItem('tok', 'abc')).toBe(true)
  expect(sessionStorage.getItem('tok')).toBe('abc')
  expect(localStorage.getItem('tok')).toBeNull()

  expect(sessionStorageGetItem('tok')).toBe('abc')
  localStorage.setItem('tok', 'wrong-store')
  expect(sessionStorageGetItem('tok')).toBe('abc')

  expect(sessionStorageRemoveItem('tok')).toBe(true)
  expect(sessionStorageGetItem('tok')).toBeUndefined()
})

test('a missing key reads as undefined, not null', () => {
  expect(sessionStorageGetItem('nope')).toBeUndefined()
})
