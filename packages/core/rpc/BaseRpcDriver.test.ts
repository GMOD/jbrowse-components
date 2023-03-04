import PluginManager from '../PluginManager'
import { checkAbortSignal } from '../util'
import BaseRpcDriver, { watchWorker, WorkerHandle } from './BaseRpcDriver'
import RpcMethodType from '../pluggableElementTypes/RpcMethodType'
import { ConfigurationSchema } from '../configuration'

function delay(ms: number) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(true)
    }, ms)
  })
}

class MockWorkerHandle implements WorkerHandle {
  busy = false

  destroy() {}

  async call(
    name: string,
    _args = [],
    opts: {
      timeout?: number
      signal?: AbortSignal
      rpcDriverClassName?: string
    } = {},
  ) {
    const { signal, timeout = 3000 } = opts
    const start = Date.now()
    switch (name) {
      case 'ping': {
        while (this.busy) {
          if (timeout < +Date.now() - start) {
            throw new Error('timeout')
          }

          await delay(50)
        }

        break
      }
      case 'doWorkShortPingTime': {
        this.busy = true
        await delay(50)
        this.busy = false
        await delay(50)
        this.busy = true
        await delay(50)
        this.busy = false
        await delay(50)
        this.busy = true
        await delay(50)
        this.busy = false

        break
      }
      case 'doWorkLongPingTime': {
        this.busy = true
        await delay(1000)
        checkAbortSignal(signal)
        this.busy = false
        await delay(1000)
        checkAbortSignal(signal)
        this.busy = true
        await delay(1000)
        checkAbortSignal(signal)
        this.busy = false

        break
      }
      case 'MockRenderTimeout': {
        this.busy = true
        await delay(10000)
        this.busy = false

        break
      }
      case 'MockRenderShort': {
        this.busy = true
        await delay(100)
        checkAbortSignal(signal)
        this.busy = false

        break
      }
      // No default
    }
  }
}
test('watch worker with long ping, generates timeout', async () => {
  const worker = new MockWorkerHandle()

  expect.assertions(1)
  try {
    const workerWatcher = watchWorker(worker, 200, 'MockRpcDriver')
    const result = worker.call('doWorkLongPingTime', undefined, {
      timeout: 100,
      rpcDriverClassName: 'MockRpcDriver',
    })
    await Promise.race([result, workerWatcher])
  } catch (e) {
    expect(`${e}`).toMatch(/timeout/)
  }
})

test('test worker abort', async () => {
  const worker = new MockWorkerHandle()
  expect.assertions(1)

  try {
    const controller = new AbortController()
    const resultP = worker.call('doWorkLongPingTime', undefined, {
      signal: controller.signal,
      timeout: 2000,
      rpcDriverClassName: 'MockRpcDriver',
    })
    controller.abort()
    await resultP
  } catch (e) {
    expect(`${e}`).toMatch(/abort/)
  }
})

test('watch worker generates multiple pings', async () => {
  const worker = new MockWorkerHandle()
  const workerWatcher = watchWorker(worker, 200, 'MockRpcDriver')
  const result = worker.call('doWorkShortPingTime')
  await Promise.race([result, workerWatcher])
})

class MockRpcDriver extends BaseRpcDriver {
  name = 'MockRpcDriver'

  maxPingTime = 1000

  workerCheckFrequency = 500

  async makeWorker() {
    return new MockWorkerHandle()
  }
}

export class MockRendererTimeout extends RpcMethodType {
  name = 'MockRenderTimeout'

  async execute() {}
}

export class MockRendererShort extends RpcMethodType {
  name = 'MockRenderShort'

  async execute() {}
}

test('test RPC driver operation timeout and worker replace', async () => {
  const consoleMock = jest.spyOn(console, 'error').mockImplementation()
  expect.assertions(1)
  const config = ConfigurationSchema('Mock', {}).create()
  const driver = new MockRpcDriver({ config })
  const pluginManager = new PluginManager()

  pluginManager.addRpcMethod(() => new MockRendererTimeout(pluginManager))
  pluginManager.addRpcMethod(() => new MockRendererShort(pluginManager))
  pluginManager.createPluggableElements()
  try {
    await driver.call(pluginManager, 'sessionId', 'MockRenderTimeout', {}, {})
  } catch (e) {
    expect(`${e}`).toMatch(/operation timed out/)
  }
  await driver.call(pluginManager, 'sessionId', 'MockRenderShort', {}, {})
  consoleMock.mockRestore()
})

test('remote abort', async () => {
  const consoleMock = jest.spyOn(console, 'error').mockImplementation()
  expect.assertions(1)
  const config = ConfigurationSchema('Mock', {}).create()
  const driver = new MockRpcDriver({ config })
  const pluginManager = new PluginManager()

  pluginManager.addRpcMethod(() => new MockRendererShort(pluginManager))
  pluginManager.createPluggableElements()
  try {
    const controller = new AbortController()
    const resP = driver.call(
      pluginManager,
      'sessionId',
      'MockRenderShort',
      {},
      { signal: controller.signal },
    )
    controller.abort()
    await resP
  } catch (e) {
    expect(`${e}`).toMatch(/abort/)
  }
  consoleMock.mockRestore()
})
