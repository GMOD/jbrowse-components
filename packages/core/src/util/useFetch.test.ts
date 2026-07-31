import { renderHook, waitFor } from '@testing-library/react'

import { checkStopToken } from './stopToken.ts'
import { useFetch } from './useFetch.ts'

import type { StopToken } from './stopToken.ts'

// The key→fetcher-argument contract. An array key is *spread* across the
// fetcher's parameters, so a fetcher reading its key must declare positional
// parameters; a single array-destructured parameter binds only the leading key
// name and silently slices characters out of it. That mistake shipped in
// MafSequenceWidget behind the hook's old `(...args: any[])` signature, so pin
// the behavior here rather than only in the types. The stop token follows the
// key arguments, so it is always last however long the key is.

test('spreads an array key across the fetcher parameters', async () => {
  const fetcher = jest.fn(async () => 'done')
  const { result } = renderHook(() =>
    useFetch(['name', { conf: 1 }, ['sampleA'], true] as const, fetcher),
  )

  await waitFor(() => {
    expect(result.current.data).toBe('done')
  })
  expect(fetcher).toHaveBeenCalledWith(
    'name',
    { conf: 1 },
    ['sampleA'],
    true,
    expect.anything(),
  )
})

test('passes a string key as the single fetcher argument', async () => {
  const fetcher = jest.fn(async () => 'done')
  const { result } = renderHook(() => useFetch('https://example.com', fetcher))

  await waitFor(() => {
    expect(result.current.data).toBe('done')
  })
  expect(fetcher).toHaveBeenCalledWith('https://example.com', expect.anything())
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

// What the token is for: a fetcher forwarding it to an RPC stops the worker
// when the dialog closes or the key moves on, instead of leaving it computing
// an answer nobody is waiting for.
test('stops the fetch stop token on unmount', async () => {
  let captured: StopToken | undefined
  const { result, unmount } = renderHook(() =>
    useFetch(['slow'] as const, async (_key, stopToken) => {
      captured = stopToken
      return 'done'
    }),
  )

  await waitFor(() => {
    expect(result.current.data).toBe('done')
  })
  expect(() => {
    checkStopToken(captured)
  }).not.toThrow()

  unmount()
  expect(() => {
    checkStopToken(captured)
  }).toThrow(/abort/i)
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
