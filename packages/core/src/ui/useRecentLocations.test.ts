import { act, renderHook } from '@testing-library/react'

import { useRecentLocations } from './useRecentLocations.ts'

// localStorage persistence is disabled under jest (see the hook), so these
// exercise the in-memory list semantics: order, dedupe, cap, and clear

test('adds locations most-recent-first', () => {
  const { result } = renderHook(() => useRecentLocations('hg38'))
  expect(result.current.recentLocations).toEqual([])
  act(() => {
    result.current.addRecentLocation('chr1')
  })
  act(() => {
    result.current.addRecentLocation('chr2')
  })
  expect(result.current.recentLocations).toEqual(['chr2', 'chr1'])
})

test('re-adding an existing location moves it to the front without duplicating', () => {
  const { result } = renderHook(() => useRecentLocations('hg38'))
  act(() => {
    result.current.addRecentLocation('chr1')
  })
  act(() => {
    result.current.addRecentLocation('chr2')
  })
  act(() => {
    result.current.addRecentLocation('chr1')
  })
  expect(result.current.recentLocations).toEqual(['chr1', 'chr2'])
})

test('caps the list at 6 entries', () => {
  const { result } = renderHook(() => useRecentLocations('hg38'))
  for (let i = 0; i < 10; i++) {
    act(() => {
      result.current.addRecentLocation(`loc${i}`)
    })
  }
  expect(result.current.recentLocations).toEqual([
    'loc9',
    'loc8',
    'loc7',
    'loc6',
    'loc5',
    'loc4',
  ])
})

test('clear empties the list', () => {
  const { result } = renderHook(() => useRecentLocations('hg38'))
  act(() => {
    result.current.addRecentLocation('chr1')
  })
  act(() => {
    result.current.clearRecentLocations()
  })
  expect(result.current.recentLocations).toEqual([])
})
