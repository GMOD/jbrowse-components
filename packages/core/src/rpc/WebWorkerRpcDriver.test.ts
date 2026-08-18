import WebWorkerRpcDriver from './WebWorkerRpcDriver.ts'
import rpcConfigSchema from './configSchema.ts'

class FakeWorker extends EventTarget {
  terminated = false
  posted: unknown[] = []

  postMessage(data: unknown) {
    this.posted.push(data)
  }

  terminate() {
    this.terminated = true
  }

  // the boot handshake messages the real rpcWorker sends back
  send(message: string, extra: Record<string, unknown> = {}) {
    this.dispatchEvent(
      new MessageEvent('message', { data: { message, ...extra } }),
    )
  }
}

function makeDriver() {
  const worker = new FakeWorker()
  const driver = new WebWorkerRpcDriver(
    {
      config: rpcConfigSchema.create({}),
      makeWorkerInstance: () => worker as unknown as Worker,
    },
    { plugins: [], windowHref: 'http://localhost/', numberGrouping: true },
  )
  return { worker, driver }
}

describe('WebWorkerRpcDriver boot handshake', () => {
  test('answers readyForConfig then resolves on ready', async () => {
    const { worker, driver } = makeDriver()
    const handleP = driver.makeWorker()

    worker.send('readyForConfig')
    expect(worker.posted[0]).toEqual({
      message: 'config',
      config: {
        plugins: [],
        windowHref: 'http://localhost/',
        numberGrouping: true,
      },
    })

    worker.send('ready')
    await expect(handleP).resolves.toBeDefined()
    expect(worker.terminated).toBe(false)
  })

  test('a worker that fails to load rejects and is terminated', async () => {
    const { worker, driver } = makeDriver()
    // WebWorkerHandle logs worker errors; keep the expected one out of the output
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const handleP = driver.makeWorker()

    worker.dispatchEvent(
      new ErrorEvent('error', { message: 'script load failed' }),
    )

    await expect(handleP).rejects.toThrow('script load failed')
    expect(worker.terminated).toBe(true)
    spy.mockRestore()
  })

  test('an error message during boot rejects and is terminated', async () => {
    const { worker, driver } = makeDriver()
    const handleP = driver.makeWorker()

    worker.send('error', {
      error: { name: 'Error', message: 'plugin blew up' },
    })

    await expect(handleP).rejects.toThrow('plugin blew up')
    expect(worker.terminated).toBe(true)
  })
})

describe('WebWorkerRpcDriver status channel', () => {
  // the `channel` is what the worker's wrapForRpc builds a statusCallback from,
  // so minting one unconditionally handed every method a live status handle its
  // caller had declined — and gave "no statusCallback" two answers, since
  // MainThreadRpcDriver passes the caller's own undefined straight through
  async function callWith(statusCallback?: (s: unknown) => void) {
    const { worker, driver } = makeDriver()
    const handleP = driver.makeWorker()
    worker.send('readyForConfig')
    worker.send('ready')
    const handle = await handleP
    worker.posted.length = 0

    void handle.call('SomeMethod', { sessionId: 's' }, { statusCallback })
    return worker.posted[0] as { data: Record<string, unknown> }
  }

  test('opens a channel when the caller passes a statusCallback', async () => {
    const posted = await callWith(() => {})
    expect(posted.data.channel).toMatch(/^message-/)
  })

  test('opens none when the caller passes no statusCallback', async () => {
    const posted = await callWith()
    expect(posted.data).not.toHaveProperty('channel')
    expect(posted.data).toEqual({ sessionId: 's' })
  })
})
