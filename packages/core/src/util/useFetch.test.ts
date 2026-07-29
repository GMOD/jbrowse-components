import { renderHook, waitFor } from '@testing-library/react'

import { useFetch } from './useFetch.ts'

// The key→fetcher-argument contract. An array key is *spread* across the
// fetcher's parameters, so a fetcher reading its key must declare positional
// parameters; a single array-destructured parameter binds only the leading key
// name and silently slices characters out of it. That mistake shipped in
// MafSequenceWidget behind the hook's old `(...args: any[])` signature, so pin
// the behavior here rather than only in the types.

test('spreads an array key across the fetcher parameters', async () => {
  const fetcher = jest.fn(async () => 'done')
  const { result } = renderHook(() =>
    useFetch(['name', { conf: 1 }, ['sampleA'], true] as const, fetcher),
  )

  await waitFor(() => {
    expect(result.current.data).toBe('done')
  })
  expect(fetcher).toHaveBeenCalledWith('name', { conf: 1 }, ['sampleA'], true)
})

test('passes a string key as the single fetcher argument', async () => {
  const fetcher = jest.fn(async () => 'done')
  const { result } = renderHook(() => useFetch('https://example.com', fetcher))

  await waitFor(() => {
    expect(result.current.data).toBe('done')
  })
  expect(fetcher).toHaveBeenCalledWith('https://example.com')
})

test('a fetcher reading the key positionally sees the real key values', async () => {
  const seen: unknown[] = []
  const { result } = renderHook(() =>
    useFetch(
      ['MafGetSequences', { conf: 'real' }, ['sampleA'], true] as const,
      async (_name, adapterConfig, samples, showAllLetters) => {
        seen.push(adapterConfig, samples, showAllLetters)
        return 'done'
      },
    ),
  )

  await waitFor(() => {
    expect(result.current.data).toBe('done')
  })
  expect(seen).toEqual([{ conf: 'real' }, ['sampleA'], true])
})

test('does not fetch on a null key, or an array key with a missing piece', () => {
  const fetcher = jest.fn(async () => 'done')
  renderHook(() => useFetch(null, fetcher))
  renderHook(() => useFetch(['offset', undefined], fetcher))

  expect(fetcher).not.toHaveBeenCalled()
})

test('surfaces a rejection as error, leaving data undefined', async () => {
  const { result } = renderHook(() =>
    useFetch(['boom'], () => Promise.reject(new Error('nope'))),
  )

  await waitFor(() => {
    expect(result.current.error).toEqual(new Error('nope'))
  })
  expect(result.current.data).toBeUndefined()
  expect(result.current.isLoading).toBe(false)
})
