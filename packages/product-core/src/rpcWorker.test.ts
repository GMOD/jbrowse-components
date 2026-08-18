import { wrapForRpc } from './rpcWorker.ts'

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
