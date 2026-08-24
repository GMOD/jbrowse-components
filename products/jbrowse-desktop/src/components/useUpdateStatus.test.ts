import { act, renderHook, waitFor } from '@testing-library/react'

import { useUpdateStatus } from './useUpdateStatus.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test('the label is set while the work runs and cleared after', async () => {
  const { result } = renderHook(() => useUpdateStatus())
  expect(result.current.status).toBeUndefined()

  const work = deferred<string>()
  let done: Promise<string> | undefined
  act(() => {
    done = result.current.updateStatus('Loading session', () => work.promise)
  })
  await waitFor(() => {
    expect(result.current.status).toBe('Loading session')
  })

  await act(async () => {
    work.resolve('loaded')
    await done
  })
  expect(result.current.status).toBeUndefined()
  await expect(done).resolves.toBe('loaded')
})

test('a throw clears the label and still reaches the caller', async () => {
  const { result } = renderHook(() => useUpdateStatus())
  await act(async () => {
    await expect(
      result.current.updateStatus('Indexing', () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
  })
  expect(result.current.status).toBeUndefined()
})

test('an inner phase restores the outer label rather than blanking it', async () => {
  const { result } = renderHook(() => useUpdateStatus())
  const inner = deferred<void>()
  const outer = deferred<void>()

  let running: Promise<void> | undefined
  act(() => {
    running = result.current.updateStatus('Outer', async () => {
      await result.current.updateStatus('Inner', () => inner.promise)
      await outer.promise
    })
  })
  await waitFor(() => {
    expect(result.current.status).toBe('Inner')
  })

  await act(async () => {
    inner.resolve()
  })
  // the inner phase's close put the enclosing label back rather than emptying
  // the channel, which is the whole reason this delegates to core's updateStatus
  await waitFor(() => {
    expect(result.current.status).toBe('Outer')
  })

  await act(async () => {
    outer.resolve()
    await running
  })
  expect(result.current.status).toBeUndefined()
})

test('the value the work returns is passed through', async () => {
  const { result } = renderHook(() => useUpdateStatus())
  await act(async () => {
    await expect(
      result.current.updateStatus('Counting', () => 42),
    ).resolves.toBe(42)
  })
})
