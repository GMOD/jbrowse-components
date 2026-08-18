import { isStopped } from '../util/stopToken.ts'
import RpcClient from './RpcClient.ts'
import RpcServer, { rpcResult, rpcResultWithArrayBuffers } from './RpcServer.ts'

// Flush all pending microtasks (promise .then chains need multiple ticks)
function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

// RpcServer captures the module-level `self` as its message target. In jsdom
// self === window === globalThis, so mocking globalThis.postMessage intercepts
// every reply the server posts.
function mockPostMessage() {
  const sent: { data: unknown; transferables?: unknown }[] = []
  const original = (globalThis as any).postMessage
  ;(globalThis as any).postMessage = (
    data: unknown,
    transferables?: unknown,
  ) => {
    sent.push({ data, transferables })
  }
  return {
    sent,
    restore: () => {
      ;(globalThis as any).postMessage = original
    },
  }
}

function makeServer(
  methods: Record<string, (data: unknown) => Promise<unknown>> = {},
) {
  return new RpcServer(methods)
}

function sendMessage(server: RpcServer, data: unknown) {
  server.handler(new MessageEvent('message', { data }) as any)
}

describe('RpcServer.handler()', () => {
  test('ignores messages without libRpc flag', async () => {
    const { sent, restore } = mockPostMessage()
    const server = makeServer({ greet: async () => 'hello' })
    sendMessage(server, { method: 'greet', uid: '1', data: null })
    await flushPromises()
    expect(sent).toHaveLength(0)
    restore()
  })

  test('dispatches to the correct method and replies', async () => {
    const { sent, restore } = mockPostMessage()
    const server = makeServer({ greet: async () => 'hello' })
    sendMessage(server, { method: 'greet', uid: '1', data: null, libRpc: true })
    await flushPromises()
    expect(sent[0]?.data).toMatchObject({
      uid: '1',
      data: 'hello',
      libRpc: true,
    })
    restore()
  })

  test('sends error for unknown method', async () => {
    const { sent, restore } = mockPostMessage()
    const server = makeServer({})
    sendMessage(server, {
      method: 'noSuchMethod',
      uid: '2',
      data: null,
      libRpc: true,
    })
    await flushPromises()
    expect(sent[0]?.data).toMatchObject({
      uid: '2',
      error: 'Unknown RPC method "noSuchMethod"',
      libRpc: true,
    })
    restore()
  })

  test('sends serialized error when method throws', async () => {
    const { sent, restore } = mockPostMessage()
    const server = makeServer({
      boom: async () => {
        throw new Error('method failed')
      },
    })
    sendMessage(server, { method: 'boom', uid: '3', data: null, libRpc: true })
    await flushPromises()
    expect((sent[0]?.data as any)?.error?.message).toBe('method failed')
    restore()
  })

  test('synchronous throw inside method is captured and serialized', async () => {
    const { sent, restore } = mockPostMessage()
    const server = makeServer({
      syncBoom: (() => {
        throw new Error('sync failure')
      }) as unknown as (data: unknown) => Promise<unknown>,
    })
    sendMessage(server, {
      method: 'syncBoom',
      uid: 'sync',
      data: null,
      libRpc: true,
    })
    await flushPromises()
    expect((sent[0]?.data as any)?.error?.message).toBe('sync failure')
    restore()
  })

  // The report is only useful if it survives the trip: it is built in `reply`'s
  // catch, has to go through serializeError, and is what a display's error
  // banner ends up showing. jsdom's postMessage does not police transfer lists,
  // so the throw is staged — the browser's own check, and the wording this keys
  // on, are pinned by the transfer-list-diagnostics browser suite instead.
  test('a failed post names the offending transferable in the error it sends', async () => {
    const original = (globalThis as any).postMessage
    const sent: unknown[] = []
    let first = true
    ;(globalThis as any).postMessage = (data: unknown) => {
      if (first) {
        first = false
        throw new DOMException(
          'Failed to execute postMessage: ArrayBuffer at index 1 is already detached',
          'DataCloneError',
        )
      }
      sent.push(data)
    }

    const dead = new Uint32Array(4).buffer
    dead.transfer()
    const starts = new Uint32Array(4)
    // The list names exactly what the payload carries — the failure being staged
    // is the detached buffer at index 1, not a mismatched list, which
    // `rpcResult` now refuses under test.
    const server = makeServer({
      pack: async () =>
        rpcResult({ starts, instanceData: { dead } }, [starts.buffer, dead]),
    })
    sendMessage(server, { method: 'pack', uid: 'p', data: null, libRpc: true })
    await flushPromises()

    const { name, message } = (sent[0] as any).error
    expect(name).toBe('DataCloneError')
    expect(message).toContain('already detached')
    expect(message).toContain('index 1 is instanceData.dead')
    ;(globalThis as any).postMessage = original
  })

  // `throw` is the last frame there is — every other failure path routes into
  // it, `reply`'s catch included — so a throw from inside it settles nothing and
  // the caller's promise stays pending for the life of the page. That is a
  // display on a spinner with no error, which is strictly worse than the error
  // it was trying to send.
  //
  // Reachable because `serializeError` copies an error's own-enumerable
  // properties to carry custom data across, skipping only the ones that are
  // themselves functions: a property holding an OBJECT with a method on it goes
  // over whole and structuredClone refuses it.
  test('falls back to the message when the error object cannot be cloned', async () => {
    const original = (globalThis as any).postMessage
    const sent: unknown[] = []
    ;(globalThis as any).postMessage = (data: unknown) => {
      if ((data as any).error?.adapter) {
        throw new DOMException(
          'Failed to execute postMessage: function could not be cloned',
          'DataCloneError',
        )
      }
      sent.push(data)
    }

    const server = makeServer({
      boom: async () => {
        const e = new Error('index read failed') as Error & {
          adapter: unknown
        }
        // an arrow-function class field is an OWN property, so this is what an
        // error carrying the adapter that produced it looks like
        e.adapter = { close: () => {} }
        throw e
      },
    })
    sendMessage(server, { method: 'boom', uid: 'nc', data: null, libRpc: true })
    await flushPromises()

    expect(sent).toHaveLength(1)
    expect((sent[0] as any).uid).toBe('nc')
    expect((sent[0] as any).error).toBe('index read failed')
    ;(globalThis as any).postMessage = original
  })

  test('passes data from message to method', async () => {
    const { sent, restore } = mockPostMessage()
    const server = makeServer({
      echo: async (data: unknown) => data,
    })
    sendMessage(server, {
      method: 'echo',
      uid: '4',
      data: { x: 1 },
      libRpc: true,
    })
    await flushPromises()
    expect((sent[0]?.data as any)?.data).toEqual({ x: 1 })
    restore()
  })
})

describe('RpcServer stop-token notifications', () => {
  test('applies a posted stopped id, so running calls see it', async () => {
    const { sent, restore } = mockPostMessage()
    const server = makeServer({})
    const token = 'server-applied-token'
    expect(isStopped(token)).toBe(false)
    sendMessage(server, { stopToken: token, libRpc: true })
    await flushPromises()
    expect(isStopped(token)).toBe(true)
    // it is not a call: nothing is replied, and in particular it must not land
    // in the unknown-method branch with no uid to answer
    expect(sent).toHaveLength(0)
    restore()
  })

  test('ignores a stop-token frame without the libRpc tag', async () => {
    const { restore } = mockPostMessage()
    const server = makeServer({})
    sendMessage(server, { stopToken: 'untagged-token' })
    await flushPromises()
    expect(isStopped('untagged-token')).toBe(false)
    restore()
  })
})

describe('RpcServer reply with rpcResult (transferables)', () => {
  test('sends transferable data with the transfer list', async () => {
    const { sent, restore } = mockPostMessage()
    const buf = new ArrayBuffer(8)
    const server = makeServer({
      withTransfer: async () => rpcResult(buf, [buf]),
    })
    sendMessage(server, {
      method: 'withTransfer',
      uid: '5',
      data: null,
      libRpc: true,
    })
    await flushPromises()
    expect((sent[0]?.data as any)?.data).toBe(buf)
    expect(sent[0]?.transferables).toEqual([buf])
    restore()
  })

  test('plain reply sends empty transferables', async () => {
    const { sent, restore } = mockPostMessage()
    const server = makeServer({ plain: async () => 42 })
    sendMessage(server, { method: 'plain', uid: '6', data: null, libRpc: true })
    await flushPromises()
    expect((sent[0]?.data as any)?.data).toBe(42)
    expect(sent[0]?.transferables).toEqual([])
    restore()
  })
})

// Only the hand-built lists need this; `rpcResultWithArrayBuffers` derives its
// own and so cannot disagree with itself. Both directions are silent otherwise —
// a forgotten field is structure-cloned and a stray entry detaches for nobody,
// and neither is a test failure anywhere.
describe('rpcResult checks a hand-built transfer list under test', () => {
  test('names a payload field the list forgot', () => {
    const starts = new Uint32Array(2)
    const ends = new Uint32Array(2)
    expect(() => rpcResult({ starts, ends }, [starts.buffer])).toThrow(/ends/)
  })

  test('reaches a field the derived walk stops short of', () => {
    const deep = new Uint32Array(2)
    expect(() => rpcResult({ groups: [{ data: { deep } }] }, [])).toThrow(
      /groups\.0\.data\.deep/,
    )
  })

  test('rejects an entry the payload does not carry', () => {
    const starts = new Uint32Array(2)
    expect(() =>
      rpcResult({ starts }, [starts.buffer, new Uint32Array(2).buffer]),
    ).toThrow(/not in the payload/)
  })

  test('accepts two views onto one buffer named once', () => {
    const backing = new ArrayBuffer(16)
    const first = new Uint32Array(backing, 0, 2)
    const second = new Uint32Array(backing, 8, 2)
    expect(() => rpcResult({ first, second }, [backing])).not.toThrow()
  })

  // `Object.entries` is blank on a Map, so a matrix keyed by sample name — what
  // the wiggle score matrix and the variant genotype matrix return — read as an
  // EMPTY payload, and the check failed in both directions at once.
  test('accepts a Map-held row the list names', () => {
    const row = new Float32Array(2)
    const matrix = new Map([['HG002', row]])
    // the wiggle matrix's list was exactly this and exactly right, and the
    // check called it "not in the payload" — the one wording that sends the
    // reader after a list bug that isn't there
    expect(() => rpcResult(matrix, [row.buffer])).not.toThrow()
  })

  test('names a Map-held row the list forgot, by its key', () => {
    const matrix = new Map([['HG002', new Float32Array(2)]])
    expect(() => rpcResult(matrix, [])).toThrow(/HG002/)
  })

  test('reaches a Map nested under a field', () => {
    const matrix = new Map([['HG002', new Float32Array(2)]])
    expect(() => rpcResult({ rows: matrix }, [])).toThrow(/rows\.HG002/)
  })

  test('reaches a Set member, which has a position rather than a name', () => {
    const members = new Set([new Float32Array(2)])
    expect(() => rpcResult({ members }, [])).toThrow(/members\.<0>/)
  })

  // A SharedArrayBuffer can only be cloned, so its absence from the list is the
  // right answer rather than an omission.
  test('does not ask for a SharedArrayBuffer', () => {
    const shared = new Int32Array(new SharedArrayBuffer(8))
    expect(() => rpcResult({ shared }, [])).not.toThrow()
  })

  test('accepts a result that IS a buffer', () => {
    const buf = new ArrayBuffer(8)
    expect(() => rpcResult(buf, [buf])).not.toThrow()
  })
})

describe('rpcResultWithArrayBuffers', () => {
  test('derives one transferable per typed-array field', () => {
    const starts = new Uint32Array(2)
    const ends = new Uint32Array(2)
    const { transferables } = rpcResultWithArrayBuffers({
      starts,
      ends,
      count: 2,
    })
    expect(transferables).toEqual([starts.buffer, ends.buffer])
  })

  test('dedupes views that share one buffer', () => {
    const backing = new ArrayBuffer(16)
    const first = new Uint32Array(backing, 0, 2)
    const second = new Uint32Array(backing, 8, 2)
    const { transferables } = rpcResultWithArrayBuffers({ first, second })
    // a duplicate entry would make postMessage throw DataCloneError
    expect(transferables).toEqual([backing])
  })

  test('skips SharedArrayBuffer-backed views, which cannot be transferred', () => {
    const shared = new Int32Array(new SharedArrayBuffer(8))
    const owned = new Uint32Array(2)
    const { transferables } = rpcResultWithArrayBuffers({ shared, owned })
    expect(transferables).toEqual([owned.buffer])
  })

  // The result IS the Map for both matrix RPCs, so the derivation has to start
  // there rather than at a field holding one.
  test('derives one transferable per row of a Map result', () => {
    const a = new Float32Array(2)
    const b = new Float32Array(2)
    const matrix = new Map([
      ['HG002', a],
      ['HG003', b],
    ])
    const { transferables } = rpcResultWithArrayBuffers(matrix)
    expect(transferables).toEqual([a.buffer, b.buffer])
  })

  // A packer that groups its arrays — `{ ...featureData, instanceData }` — was
  // the case the caller had to hand-maintain, and hand-maintaining it is what
  // produced a DataCloneError naming an index nobody could see.
  test('reaches one level into a grouped field', () => {
    const starts = new Uint32Array(2)
    const bp1 = new Float32Array(2)
    const { transferables } = rpcResultWithArrayBuffers({
      starts,
      instanceData: { bp1, instanceCount: 2 },
    })
    expect(transferables).toEqual([starts.buffer, bp1.buffer])
  })

  test('dedupes across the nesting, not only within a level', () => {
    const backing = new ArrayBuffer(16)
    const outer = new Uint32Array(backing, 0, 2)
    const inner = new Uint32Array(backing, 8, 2)
    const { transferables } = rpcResultWithArrayBuffers({
      outer,
      group: { inner },
    })
    expect(transferables).toEqual([backing])
  })

  // postMessage's own report is "ArrayBuffer at index N is already detached",
  // and N is a position in a list the reader never sees. Naming the field is the
  // difference between a diagnosis and a bisect.
  test('names the field holding an already-detached buffer', () => {
    const stale = new Uint32Array(2)
    // ArrayBuffer.prototype.transfer rather than a postMessage: it detaches the
    // same way and needs no worker or MessageChannel, so this asserts the check
    // rather than the test environment's structured-clone support.
    stale.buffer.transfer()

    expect(() =>
      rpcResultWithArrayBuffers({ instanceData: { alignmentLengths: stale } }),
    ).toThrow(/instanceData\.alignmentLengths/)
  })
})

describe('RpcClient + RpcServer round-trip', () => {
  test('client call resolves with server response', async () => {
    // Wire server's postMessage → client's message handler
    // and client's worker.postMessage → server's handler
    const serverMessageHandlers: ((e: MessageEvent) => void)[] = []
    const clientMessageHandlers: ((e: MessageEvent) => void)[] = []

    const fakeWorker = {
      postMessage: (data: unknown) => {
        for (const h of serverMessageHandlers) {
          h(new MessageEvent('message', { data }))
        }
      },
      addEventListener: (type: string, handler: (e: unknown) => void) => {
        if (type === 'message') {
          clientMessageHandlers.push(handler as (e: MessageEvent) => void)
        }
      },
    }

    const originalPost = (globalThis as any).postMessage
    ;(globalThis as any).postMessage = (data: unknown) => {
      for (const h of clientMessageHandlers) {
        h(new MessageEvent('message', { data }))
      }
    }

    const server = new RpcServer({ add: async (data: any) => data.a + data.b })
    serverMessageHandlers.push(e => {
      server.handler(e)
    })

    const client = new RpcClient(fakeWorker as unknown as Worker)
    const result = await client.call('add', { a: 3, b: 4 })
    expect(result).toBe(7)
    ;(globalThis as any).postMessage = originalPost
  })

  test('client call rejects when server method throws', async () => {
    const serverMessageHandlers: ((e: MessageEvent) => void)[] = []
    const clientMessageHandlers: ((e: MessageEvent) => void)[] = []

    const fakeWorker = {
      postMessage: (data: unknown) => {
        for (const h of serverMessageHandlers) {
          h(new MessageEvent('message', { data }))
        }
      },
      addEventListener: (type: string, handler: (e: unknown) => void) => {
        if (type === 'message') {
          clientMessageHandlers.push(handler as (e: MessageEvent) => void)
        }
      },
    }

    const originalPost = (globalThis as any).postMessage
    ;(globalThis as any).postMessage = (data: unknown) => {
      for (const h of clientMessageHandlers) {
        h(new MessageEvent('message', { data }))
      }
    }

    const server = new RpcServer({
      fail: async () => {
        throw new Error('intentional failure')
      },
    })
    serverMessageHandlers.push(e => {
      server.handler(e)
    })

    const client = new RpcClient(fakeWorker as unknown as Worker)
    await expect(client.call('fail', {})).rejects.toThrow('intentional failure')
    ;(globalThis as any).postMessage = originalPost
  })
})
