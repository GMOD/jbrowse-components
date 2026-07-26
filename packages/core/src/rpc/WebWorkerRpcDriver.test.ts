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
    { plugins: [], windowHref: 'http://localhost/' },
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
      config: { plugins: [], windowHref: 'http://localhost/' },
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
