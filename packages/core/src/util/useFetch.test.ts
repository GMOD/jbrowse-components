import { act, renderHook, waitFor } from '@testing-library/react'

import { checkStopToken } from './stopToken.ts'
import { useFetch } from './useFetch.ts'

import type { StopToken } from './stopToken.ts'

// The key→fetcher-argument contract. An array key is *spread* across the
// fetcher's parameters, so a fetcher reading its key must declare positional
// parameters; a single array-destructured parameter binds only the leading key
// name and silently slices characters out of it. That mistake shipped in
// MafSequenceWidget behind the hook's old `(...args: any[])` signature, so pin
// the behavior here rather than only in the types. The stop token and the status
// callback follow the key arguments, in that order, so they are always the last
// two however long the key is.

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
    expect.any(Function),
  )
})

test('passes a string key as the single fetcher argument', async () => {
  const fetcher = jest.fn(async () => 'done')
  const { result } = renderHook(() => useFetch('https://example.com', fetcher))

  await waitFor(() => {
    expect(result.current.data).toBe('done')
  })
  expect(fetcher).toHaveBeenCalledWith(
    'https://example.com',
    expect.anything(),
    expect.any(Function),
  )
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

// A null fetcher is the second "don't fetch" signal, and it resolves
// independently of the key — a caller can hold a stable key while the thing it
// fetches with (an adapter, a config, a lazily-created client) arrives later.
// The fetch effect reads the fetcher off a ref, so gating it on the key alone
// left that case permanently stuck: nothing re-ran the effect when the fetcher
// appeared.
test('fetches once a null fetcher resolves under an unchanged key', async () => {
  const fetcher = jest.fn(async () => 'done')
  const { result, rerender } = renderHook(
    ({ ready }: { ready: boolean }) =>
      useFetch(['stable'] as const, ready ? fetcher : null),
    { initialProps: { ready: false } },
  )

  expect(fetcher).not.toHaveBeenCalled()
  expect(result.current.isLoading).toBe(false)

  rerender({ ready: true })

  await waitFor(() => {
    expect(result.current.data).toBe('done')
  })
  expect(fetcher).toHaveBeenCalledTimes(1)
})

// The inverse: a fetcher going away is a real "stop fetching", so the prior
// result must clear rather than linger as if it were still current.
test('clears data when the fetcher goes null under an unchanged key', async () => {
  const { result, rerender } = renderHook(
    ({ ready }: { ready: boolean }) =>
      useFetch(['stable'] as const, ready ? async () => 'done' : null),
    { initialProps: { ready: true } },
  )

  await waitFor(() => {
    expect(result.current.data).toBe('done')
  })

  rerender({ ready: false })

  await waitFor(() => {
    expect(result.current.data).toBeUndefined()
  })
  expect(result.current.isLoading).toBe(false)
})

// A mutate() refetch asks the same question again, so the answer on screen is a
// stale version of the same thing. Blanking it made every consumer flash its
// empty state on each revalidate — the desktop start screen showed "No sessions
// available" after each rename or delete.
test('a mutate() refetch keeps the previous data visible while it runs', async () => {
  // each call parks its resolver, so the test decides when a fetch finishes and
  // can look at the hook while the second one is still in flight
  const resolvers: ((answer: string) => void)[] = []
  const { result } = renderHook(() =>
    useFetch(
      ['stable'] as const,
      () =>
        new Promise<string>(resolve => {
          resolvers.push(resolve)
        }),
    ),
  )

  await waitFor(() => {
    expect(resolvers).toHaveLength(1)
  })
  act(() => {
    resolvers[0]!('first')
  })
  await waitFor(() => {
    expect(result.current.data).toBe('first')
  })

  act(() => {
    result.current.mutate()
  })
  await waitFor(() => {
    expect(resolvers).toHaveLength(2)
  })

  // in flight, and the previous answer is still on screen rather than a blank
  expect(result.current.isLoading).toBe(true)
  expect(result.current.data).toBe('first')

  act(() => {
    resolvers[1]!('second')
  })
  await waitFor(() => {
    expect(result.current.data).toBe('second')
  })
})

// The other half: a different key is a different question, so its old answer
// must not sit there looking like the new one.
test('a key change still clears the previous data', async () => {
  const { result, rerender } = renderHook(
    ({ id }: { id: string }) =>
      useFetch([id] as const, async key => `answer for ${key}`),
    { initialProps: { id: 'a' } },
  )

  await waitFor(() => {
    expect(result.current.data).toBe('answer for a')
  })

  rerender({ id: 'b' })

  expect(result.current.data).toBeUndefined()
  await waitFor(() => {
    expect(result.current.data).toBe('answer for b')
  })
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

// The effect that sets isLoading runs after the first paint, so a `false` seed
// let the resolved-and-empty state render for a frame first: an empty attribute
// table in FileInfoPanel, and the `|| data === undefined` workarounds in
// RefNameInfoDialog / GetSequenceDialog.
test('is loading on the very first render when it will fetch', () => {
  const { result } = renderHook(() =>
    useFetch(['slow'] as const, async () => 'done'),
  )
  expect(result.current.isLoading).toBe(true)
  expect(result.current.isValidating).toBe(true)
})

test('is not loading on the first render when there is nothing to fetch', () => {
  expect(
    renderHook(() => useFetch(null, async () => 'done')).result.current
      .isLoading,
  ).toBe(false)
  expect(
    renderHook(() => useFetch(['offset', undefined], async () => 'done')).result
      .current.isLoading,
  ).toBe(false)
  expect(
    renderHook(() => useFetch(['key'] as const, null)).result.current.isLoading,
  ).toBe(false)
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
