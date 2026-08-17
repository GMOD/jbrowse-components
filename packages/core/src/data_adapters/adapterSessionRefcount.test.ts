import {
  releaseAdapterSession,
  retainAdapterSession,
} from './adapterSessionRefcount.ts'

function makeRpcManager() {
  const calls: { sessionId: string; args: Record<string, unknown> }[] = []
  const rpcManager = {
    calls,
    // eslint-disable-next-line @typescript-eslint/require-await
    async call(
      sessionId: string,
      functionName: string,
      args: Record<string, unknown>,
    ) {
      if (functionName === 'CoreFreeResources') {
        calls.push({ sessionId, args })
      }
      return undefined
    },
  }
  return rpcManager
}

test('one track: retained then released frees once', async () => {
  const rpc = makeRpcManager()
  retainAdapterSession(rpc, 'adapterA')
  await releaseAdapterSession(rpc, 'adapterA')
  expect(rpc.calls).toEqual([
    { sessionId: 'adapterA', args: { sessionId: 'adapterA' } },
  ])
})

// the same track shown in two linear genome views is two track models sharing
// one rpcSessionId; closing it in one view must not evict the adapter the other
// is still querying
test('same track in two views: closing one does not free', async () => {
  const rpc = makeRpcManager()
  retainAdapterSession(rpc, 'adapterA')
  retainAdapterSession(rpc, 'adapterA')

  await releaseAdapterSession(rpc, 'adapterA')
  expect(rpc.calls).toEqual([])

  await releaseAdapterSession(rpc, 'adapterA')
  expect(rpc.calls).toHaveLength(1)
})

test('reopening after the last close frees again', async () => {
  const rpc = makeRpcManager()
  retainAdapterSession(rpc, 'adapterA')
  await releaseAdapterSession(rpc, 'adapterA')
  retainAdapterSession(rpc, 'adapterA')
  await releaseAdapterSession(rpc, 'adapterA')
  expect(rpc.calls).toHaveLength(2)
})

test('distinct adapters are counted independently', async () => {
  const rpc = makeRpcManager()
  retainAdapterSession(rpc, 'adapterA')
  retainAdapterSession(rpc, 'adapterB')
  await releaseAdapterSession(rpc, 'adapterA')
  expect(rpc.calls.map(c => c.sessionId)).toEqual(['adapterA'])
})

test('an unretained release frees rather than going negative', async () => {
  const rpc = makeRpcManager()
  await releaseAdapterSession(rpc, 'adapterA')
  // a cached -1 here would swallow the next real free
  await releaseAdapterSession(rpc, 'adapterA')
  expect(rpc.calls).toHaveLength(2)
})

test('counts do not leak between sessions', async () => {
  const one = makeRpcManager()
  const two = makeRpcManager()
  retainAdapterSession(one, 'adapterA')
  retainAdapterSession(one, 'adapterA')

  // the second session has its own count, so its single track frees on close
  retainAdapterSession(two, 'adapterA')
  await releaseAdapterSession(two, 'adapterA')
  expect(two.calls).toHaveLength(1)
  expect(one.calls).toEqual([])
})

test('the free carries only the session it is freeing', async () => {
  const rpc = makeRpcManager()
  retainAdapterSession(rpc, 'adapterA')
  await releaseAdapterSession(rpc, 'adapterA')
  expect(rpc.calls[0]!.args).toEqual({ sessionId: 'adapterA' })
})

test('a failing free does not reject into the teardown path', async () => {
  const rpc = {
    async call() {
      throw new Error('worker already terminated')
    },
  }
  retainAdapterSession(rpc, 'adapterA')
  await expect(releaseAdapterSession(rpc, 'adapterA')).resolves.toBeUndefined()
})
