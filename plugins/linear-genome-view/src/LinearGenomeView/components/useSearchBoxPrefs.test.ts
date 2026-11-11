import { act, renderHook } from '@testing-library/react'

import {
  searchBoxMenuItems,
  storedSearchBoxPrefs,
  useSearchBoxPrefs,
} from './useSearchBoxPrefs.ts'

afterEach(() => {
  jest.restoreAllMocks()
  localStorage.clear()
})

test('a header follows a write made through the stored prefs', () => {
  const { result } = renderHook(() => useSearchBoxPrefs('follow', 2))
  expect(result.current.showSearchBoxes).toBe(true)
  act(() => {
    storedSearchBoxPrefs('follow', 2).setShowSearchBoxes(false)
  })
  expect(result.current.showSearchBoxes).toBe(false)
  expect(storedSearchBoxPrefs('follow', 2).showSearchBoxes).toBe(false)
  expect(localStorage.getItem('follow-showSearchBoxes-compact')).toBe('false')
})

test('the stored prefs follow a write made through a header', () => {
  const { result } = renderHook(() => useSearchBoxPrefs('header', 2))
  act(() => {
    result.current.setSideBySide(false)
  })
  expect(result.current.sideBySide).toBe(false)
  expect(storedSearchBoxPrefs('header', 2).sideBySide).toBe(false)
})

test('each regime keeps its own choice and default', () => {
  expect(storedSearchBoxPrefs('regime', 4).showSearchBoxes).toBe(false)
  storedSearchBoxPrefs('regime', 4).setShowSearchBoxes(true)
  expect(storedSearchBoxPrefs('regime', 4).showSearchBoxes).toBe(true)
  storedSearchBoxPrefs('regime', 2).setShowSearchBoxes(false)
  expect(storedSearchBoxPrefs('regime', 2).showSearchBoxes).toBe(false)
  expect(storedSearchBoxPrefs('regime', 4).showSearchBoxes).toBe(true)
})

test('a write the store refuses still reaches the header and the menu', () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('QuotaExceededError')
  })
  const { result } = renderHook(() => useSearchBoxPrefs('refused', 2))
  act(() => {
    storedSearchBoxPrefs('refused', 2).setShowSearchBoxes(false)
  })
  expect(localStorage.getItem('refused-showSearchBoxes-compact')).toBeNull()
  expect(result.current.showSearchBoxes).toBe(false)
  expect(storedSearchBoxPrefs('refused', 2).showSearchBoxes).toBe(false)
  act(() => {
    result.current.setShowSearchBoxes(true)
  })
  expect(storedSearchBoxPrefs('refused', 2).showSearchBoxes).toBe(true)
})

test('the rows disable together', () => {
  const rows = searchBoxMenuItems(storedSearchBoxPrefs('rows', 2), {
    disabled: true,
  })
  expect(rows.map(row => 'disabled' in row && row.disabled)).toEqual([
    true,
    true,
  ])
})
