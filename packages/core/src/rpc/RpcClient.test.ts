import RpcClient from './RpcClient.ts'

class FakeWorker extends EventTarget {
  sent: unknown[] = []

  postMessage(data: unknown) {
    this.sent.push(data)
  }

  terminate() {}
}

function makeClient() {
  const worker = new FakeWorker()
  const client = new RpcClient(worker as unknown as Worker)
  return { worker, client }
}

function reply(
  worker: FakeWorker,
  uid: string,
  data: unknown,
  method = 'testMethod',
) {
  worker.dispatchEvent(
    new MessageEvent('message', {
      data: { uid, method, data, libRpc: true },
    }),
  )
}

function replyError(worker: FakeWorker, uid: string, message: string) {
  worker.dispatchEvent(
    new MessageEvent('message', {
      data: {
        uid,
        error: { message, name: 'Error', stack: '' },
        libRpc: true,
      },
    }),
  )
}

describe('RpcClient.call()', () => {
  test('sends correct postMessage format', () => {
    const { worker, client } = makeClient()
    client.call('CoreGetFeatures', { regions: [] })
    expect(worker.sent[0]).toMatchObject({
      method: 'CoreGetFeatures',
      uid: '1',
      data: { regions: [] },
      libRpc: true,
    })
  })

  test('uids increment per call', () => {
    const { worker, client } = makeClient()
    client.call('m1', {})
    client.call('m2', {})
    expect((worker.sent[0] as any).uid).toBe('1')
    expect((worker.sent[1] as any).uid).toBe('2')
  })

  test('resolves with data on success response', async () => {
    const { worker, client } = makeClient()
    const p = client.call('m', {})
    reply(worker, '1', 'result')
    await expect(p).resolves.toBe('result')
  })

  test('rejects with deserialized error on error response', async () => {
    const { worker, client } = makeClient()
    const p = client.call('m', {})
    replyError(worker, '1', 'something went wrong')
    await expect(p).rejects.toThrow('something went wrong')
  })

  test('ignores messages without libRpc flag', async () => {
    const { worker, client } = makeClient()
    client.call('m', {})
    worker.dispatchEvent(
      new MessageEvent('message', {
        data: { uid: '1', method: 'm', data: 'result' }, // no libRpc
      }),
    )
    expect(client.pending.size).toBe(1)
  })
})

describe('RpcClient pending map', () => {
  test('call adds to pending, resolve removes it', async () => {
    const { worker, client } = makeClient()
    expect(client.pending.size).toBe(0)
    const p = client.call('m', {})
    expect(client.pending.size).toBe(1)
    reply(worker, '1', 'ok')
    await p
    expect(client.pending.size).toBe(0)
  })

  test('call adds to pending, reject removes it', async () => {
    const { worker, client } = makeClient()
    const p = client.call('m', {})
    expect(client.pending.size).toBe(1)
    replyError(worker, '1', 'oops')
    await p.catch(() => {})
    expect(client.pending.size).toBe(0)
  })

  test('multiple concurrent calls tracked independently', async () => {
    const { worker, client } = makeClient()
    const p1 = client.call('m', {})
    const p2 = client.call('m', {})
    expect(client.pending.size).toBe(2)

    reply(worker, '1', 'first')
    await p1
    expect(client.pending.size).toBe(1)

    reply(worker, '2', 'second')
    await p2
    expect(client.pending.size).toBe(0)
  })

  test('stale uid in response is a no-op', () => {
    const { worker, client } = makeClient()
    client.call('m', {})
    reply(worker, '999', 'phantom') // uid that was never sent
    expect(client.pending.size).toBe(1)
  })
})

describe('RpcClient worker crash (catch)', () => {
  test('rejects all pending calls with the worker error', async () => {
    const { worker, client } = makeClient()
    const p1 = client.call('m1', {})
    const p2 = client.call('m2', {})
    expect(client.pending.size).toBe(2)

    worker.dispatchEvent(new ErrorEvent('error', { message: 'worker crashed' }))

    await expect(p1).rejects.toThrow('worker crashed')
    await expect(p2).rejects.toThrow('worker crashed')
    expect(client.pending.size).toBe(0)
  })

  test('emits error event after rejecting pending calls', async () => {
    const { worker, client } = makeClient()
    const errors: unknown[] = []
    client.on('error', e => errors.push(e))

    const p = client.call('m', {})
    worker.dispatchEvent(
      new ErrorEvent('error', {
        message: 'boom',
        lineno: 42,
        filename: 'worker.js',
      }),
    )
    await p.catch(() => {})

    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ message: 'boom', lineno: 42, filename: 'worker.js' })
  })

  test('worker crash with no pending calls just emits error', () => {
    const { worker, client } = makeClient()
    const errors: unknown[] = []
    client.on('error', e => errors.push(e))

    worker.dispatchEvent(new ErrorEvent('error', { message: 'idle crash' }))
    expect(errors).toHaveLength(1)
    expect(client.pending.size).toBe(0)
  })

  test('response arriving after crash is ignored', async () => {
    const { worker, client } = makeClient()
    const p = client.call('m', {})
    worker.dispatchEvent(new ErrorEvent('error', { message: 'crash' }))
    await p.catch(() => {})

    // Late response should be a no-op, not throw
    expect(() => reply(worker, '1', 'too late')).not.toThrow()
    expect(client.pending.size).toBe(0)
  })
})

describe('RpcClient event subscriptions', () => {
  test('on/emit/off work correctly', () => {
    const { client } = makeClient()
    const received: unknown[] = []
    const listener = (d: unknown) => received.push(d)

    client.on('ch', listener)
    client.emit('ch', 'a')
    client.emit('ch', 'b')
    client.off('ch', listener)
    client.emit('ch', 'ignored')

    expect(received).toEqual(['a', 'b'])
  })

  test('server-sent events dispatch to listeners', () => {
    const { worker, client } = makeClient()
    const received: unknown[] = []
    client.on('status', d => received.push(d))

    worker.dispatchEvent(
      new MessageEvent('message', {
        data: { eventName: 'status', data: 'loading...', libRpc: true },
      }),
    )

    expect(received).toEqual(['loading...'])
  })

  test('multiple listeners on same event all fire', () => {
    const { client } = makeClient()
    const a: unknown[] = []
    const b: unknown[] = []
    client.on('e', d => a.push(d))
    client.on('e', d => b.push(d))
    client.emit('e', 42)
    expect(a).toEqual([42])
    expect(b).toEqual([42])
  })
})
