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

function reply(worker: FakeWorker, uid: string, data: unknown) {
  worker.dispatchEvent(
    new MessageEvent('message', {
      data: { uid, data, libRpc: true },
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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    client.call('m1', {})
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
    expect(errors[0]).toMatchObject({
      message: 'boom',
      lineno: 42,
      filename: 'worker.js',
    })
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
    expect(() => {
      reply(worker, '1', 'too late')
    }).not.toThrow()
    expect(client.pending.size).toBe(0)
  })
})

describe('RpcClient.destroy()', () => {
  test('rejects pending calls so they do not outlive the worker', async () => {
    const { client } = makeClient()
    const p1 = client.call('m1', {})
    const p2 = client.call('m2', {})

    client.destroy()

    await expect(p1).rejects.toThrow('RPC worker was terminated')
    await expect(p2).rejects.toThrow('RPC worker was terminated')
    expect(client.pending.size).toBe(0)
  })

  test('drops event listeners', () => {
    const { client } = makeClient()
    const received: unknown[] = []
    client.on('ch', d => received.push(d))

    client.destroy()
    client.emit('ch', 'after destroy')

    expect(received).toEqual([])
  })
})

describe('RpcClient non-cloneable payload', () => {
  test('rejects and drops the pending entry when postMessage throws', async () => {
    const worker = new FakeWorker()
    worker.postMessage = () => {
      throw new DOMException('could not be cloned', 'DataCloneError')
    }
    const client = new RpcClient(worker as unknown as Worker)

    await expect(client.call('m', { fn: () => {} })).rejects.toThrow(
      'could not be cloned',
    )
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

// The three frame kinds are told apart by which key the frame carries, never by
// whether that key's value looks useful. RpcServer.throw's last-resort fallback
// posts `error: error.message`, and `new Error()` has an empty one — read as a
// reply, that resolved the call with `undefined`, so the guard against a call
// that never settles produced a wrong value instead. deserializeReturn then runs
// on nothing and the caller blames its own display.
describe('RpcClient error frames', () => {
  test('an error frame with an empty message still rejects', async () => {
    const { worker, client } = makeClient()
    const p = client.call('CoreGetFeatures', {})
    const uid = (worker.sent[0] as { uid: string }).uid
    worker.dispatchEvent(
      new MessageEvent('message', { data: { uid, error: '', libRpc: true } }),
    )
    await expect(p).rejects.toThrow()
  })

  test('a reply frame carrying no error still resolves', async () => {
    const { worker, client } = makeClient()
    const p = client.call('CoreGetFeatures', {})
    const uid = (worker.sent[0] as { uid: string }).uid
    reply(worker, uid, { features: [] })
    await expect(p).resolves.toEqual({ features: [] })
  })

  test('a falsy reply value is not mistaken for an error frame', async () => {
    const { worker, client } = makeClient()
    const p = client.call('CoreGetFeatures', {})
    const uid = (worker.sent[0] as { uid: string }).uid
    reply(worker, uid, 0)
    await expect(p).resolves.toBe(0)
  })
})
