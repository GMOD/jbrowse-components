import RpcClient from './RpcClient.ts'
import RpcServer, { rpcResult } from './RpcServer.ts'

// Flush all pending microtasks (promise .then chains need multiple ticks)
function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

// RpcServer uses `workerSelf = self as WorkerSelf` (module-level).
// In jsdom self === window === globalThis, so mocking globalThis.postMessage
// intercepts all workerSelf.postMessage calls.
function mockPostMessage() {
  const sent: Array<{ data: unknown; transferables?: unknown }> = []
  const original = (globalThis as any).postMessage
  ;(globalThis as any).postMessage = (data: unknown, transferables?: unknown) => {
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
  server['handler'](new MessageEvent('message', { data }))
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
      method: 'greet',
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

  test('passes data from message to method', async () => {
    const { sent, restore } = mockPostMessage()
    const server = makeServer({
      echo: async (data: unknown) => data,
    })
    sendMessage(server, { method: 'echo', uid: '4', data: { x: 1 }, libRpc: true })
    await flushPromises()
    expect((sent[0]?.data as any)?.data).toEqual({ x: 1 })
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
    serverMessageHandlers.push(e => server['handler'](e))

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
    serverMessageHandlers.push(e => server['handler'](e))

    const client = new RpcClient(fakeWorker as unknown as Worker)
    await expect(client.call('fail', {})).rejects.toThrow('intentional failure')

    ;(globalThis as any).postMessage = originalPost
  })
})
