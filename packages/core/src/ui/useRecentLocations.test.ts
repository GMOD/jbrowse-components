import { act, renderHook } from '@testing-library/react'

import { instanceScopedKey } from './useAssemblySelection.ts'
import { useRecentLocations } from './useRecentLocations.ts'

// list semantics: order, dedupe, cap, clear, and the round trip through
// localStorage (cleared between tests by config/jest/localStorage.js)

const row = (label: string, loc?: string) => ({ label, loc })

test('adds locations most-recent-first', () => {
  const { result } = renderHook(() => useRecentLocations('hg38'))
  expect(result.current.recentLocations).toEqual([])
  act(() => {
    result.current.addRecentLocation(row('chr1'))
  })
  act(() => {
    result.current.addRecentLocation(row('chr2'))
  })
  expect(result.current.recentLocations).toEqual([row('chr2'), row('chr1')])
})

test('re-adding an existing location moves it to the front without duplicating', () => {
  const { result } = renderHook(() => useRecentLocations('hg38'))
  act(() => {
    result.current.addRecentLocation(row('chr1'))
  })
  act(() => {
    result.current.addRecentLocation(row('chr2'))
  })
  act(() => {
    result.current.addRecentLocation(row('chr1'))
  })
  expect(result.current.recentLocations).toEqual([row('chr1'), row('chr2')])
})

test('two labels for the same location are one row', () => {
  const { result } = renderHook(() => useRecentLocations('hg38'))
  act(() => {
    result.current.addRecentLocation(row('Apple3', 'ctgA:17400..23000'))
  })
  act(() => {
    // the same feature found by its ID rather than its name
    result.current.addRecentLocation(
      row('Apple3 (rna-Apple3)', 'ctgA:17400..23000'),
    )
  })
  expect(result.current.recentLocations).toEqual([
    row('Apple3 (rna-Apple3)', 'ctgA:17400..23000'),
  ])
})

test('caps the list at 6 entries', () => {
  const { result } = renderHook(() => useRecentLocations('hg38'))
  for (let i = 0; i < 10; i++) {
    act(() => {
      result.current.addRecentLocation(row(`loc${i}`))
    })
  }
  expect(result.current.recentLocations.map(r => r.label)).toEqual([
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
    result.current.addRecentLocation(row('chr1'))
  })
  act(() => {
    result.current.clearRecentLocations()
  })
  expect(result.current.recentLocations).toEqual([])
})

test('persists per assembly, and not at all without one', () => {
  const { result, unmount } = renderHook(() => useRecentLocations('hg38'))
  act(() => {
    result.current.addRecentLocation(row('chr1'))
  })
  unmount()

  expect(
    renderHook(() => useRecentLocations('hg38')).result.current.recentLocations,
  ).toEqual([row('chr1')])
  expect(
    renderHook(() => useRecentLocations('hg19')).result.current.recentLocations,
  ).toEqual([])
  expect(
    renderHook(() => useRecentLocations()).result.current.recentLocations,
  ).toEqual([])
})

test('reads rows written as bare strings before locations were recorded', () => {
  localStorage.setItem(
    instanceScopedKey('recentLocations', 'hg38'),
    JSON.stringify(['chr1', 'BRCA']),
  )

  const { result } = renderHook(() => useRecentLocations('hg38'))
  expect(result.current.recentLocations).toEqual([
    { label: 'chr1' },
    { label: 'BRCA' },
  ])
  // and a legacy row still dedupes against a new one
  act(() => {
    result.current.addRecentLocation(row('BRCA'))
  })
  expect(result.current.recentLocations).toEqual([
    { label: 'BRCA' },
    { label: 'chr1' },
  ])
})
