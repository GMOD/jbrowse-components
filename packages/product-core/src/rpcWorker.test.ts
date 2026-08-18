import { initializeWorker, wrapForRpc } from './rpcWorker.ts'

// The worker half of "nobody asked for status". `WebWorkerHandle.call` mints a
// `channel` only when the caller passed a statusCallback, so the presence of one
// here is the driver's statement that someone is listening — and its absence has
// to travel, because every "no statusCallback" branch downstream is a real one
// (the byte reporter `downloadStatus` withholds, the emit
// `createProgressReporter` gates).

test('a call with a channel gets a statusCallback that emits on it', async () => {
  const emitted: [string, unknown][] = []
  ;(self as unknown as { rpcServer: unknown }).rpcServer = {
    emit: (name: string, data: unknown) => {
      emitted.push([name, data])
    },
  }
  let seen: Record<string, unknown> | undefined
  await wrapForRpc(async args => {
    seen = args as Record<string, unknown>
  })({ channel: 'message-abc', sessionId: 's' })

  const statusCallback = seen!.statusCallback as (s: string) => void
  statusCallback('Downloading')
  expect(emitted).toEqual([['message-abc', 'Downloading']])
  // and the channel itself does not ride through into the method's arguments —
  // it is transport bookkeeping, the mirror of `BaseRpcDriver.call` stripping
  // `statusCallback` on the way out
  expect(seen).not.toHaveProperty('channel')
})

test('a call with no channel gets no statusCallback at all', async () => {
  let seen: Record<string, unknown> | undefined
  await wrapForRpc(async args => {
    seen = args as Record<string, unknown>
  })({ sessionId: 's' })

  // not "a callback that emits nowhere" — the key must be absent, because a
  // present-but-inert one still reads as truthy at every `statusCallback ?`
  // branch in the worker, which is what made those branches unreachable
  expect(seen).not.toHaveProperty('statusCallback')
  expect(seen).toEqual({ sessionId: 's' })
})

// initializeWorker's catch sends the boot handshake's LAST frame, so a throw
// inside it settles nothing: it runs floating, the rejection is only logged, and
// no ErrorEvent follows because a rejected promise is not a script error. The
// boot promise in WebWorkerRpcDriver then never settles, and since `invalidate`
// hangs off its rejection the pool hands every later caller that same pending
// promise — every RPC on the slot awaits forever behind a spinner and no error.
//
// serializeError copies own-enumerable properties and skips only the ones that
// are themselves functions, so an error whose `cause` is an object with a method
// on it travels as an object postMessage cannot clone.
test('a boot failure whose error cannot be cloned is still reported', async () => {
  const posts: unknown[] = []
  const original = globalThis.postMessage
  globalThis.postMessage = ((msg: unknown) => {
    const m = msg as { message?: string; error?: unknown }
    // stands in for the structured clone the real postMessage runs
    if (m.message === 'error' && typeof m.error === 'object') {
      throw new Error('could not be cloned')
    }
    posts.push(msg)
  }) as typeof globalThis.postMessage

  try {
    const booted = initializeWorker([], {
      fetchESM: () => {
        const e = new Error('plugin exploded') as Error & { cause: unknown }
        e.cause = { read: () => {} }
        throw e
      },
    })
    self.dispatchEvent(
      new MessageEvent('message', {
        data: {
          message: 'config',
          config: {
            plugins: [{ esmUrl: 'https://example.com/p.js' }],
            windowHref: 'https://example.com',
            numberGrouping: true,
          },
        },
      }),
    )
    await booted
  } finally {
    globalThis.postMessage = original
  }

  const errors = posts.filter(
    (p): p is { message: string; error: string } =>
      (p as { message?: string }).message === 'error',
  )
  expect(errors).toHaveLength(1)
  expect(typeof errors[0]!.error).toBe('string')
  expect(errors[0]!.error).toContain('plugin exploded')
})
