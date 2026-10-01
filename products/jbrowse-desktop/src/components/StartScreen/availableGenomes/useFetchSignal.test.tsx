import { renderHook, waitFor } from '@testing-library/react'

import { useGenomesData } from './useGenomesData.ts'
import { useGlobalSearch } from './useGlobalSearch.ts'

const params = {
  searchQuery: '',
  filterOption: 'all' as const,
  showOnlyFavs: false,
  favoriteIds: new Set<string>(),
}

function stubFetch() {
  const signals: (AbortSignal | undefined | null)[] = []
  jest.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
    signals.push(init?.signal)
    return new Promise<Response>(() => {})
  })
  return signals
}

afterEach(() => {
  jest.restoreAllMocks()
})

test('useGenomesData aborts its request on unmount', async () => {
  const signals = stubFetch()
  const { unmount } = renderHook(() =>
    useGenomesData({ ...params, url: 'https://example.com/a.json' }),
  )
  await waitFor(() => {
    expect(signals[0]).toBeInstanceOf(AbortSignal)
  })
  unmount()
  expect(signals[0]!.aborted).toBe(true)
})

test('useGlobalSearch aborts its request on unmount', async () => {
  const signals = stubFetch()
  const { unmount } = renderHook(() =>
    useGlobalSearch({ enabled: true, searchQuery: '' }),
  )
  await waitFor(() => {
    expect(signals[0]).toBeInstanceOf(AbortSignal)
  })
  unmount()
  expect(signals[0]!.aborted).toBe(true)
})
