import PluginManager from '../PluginManager'
import BaseRpcDriver, { watchWorker } from './BaseRpcDriver'
import RpcMethodType from '../pluggableElementTypes/RpcMethodType'

function timeout(ms: number) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}

class MockWorkerHandle {
  busy = false

  destroy() {}

  async call(
    name: string,
    args = [],
    opts: { timeout: number } = { timeout: 3000 },
  ) {
    const start = Date.now()
    if (name === 'ping') {
      while (this.busy) {
        if (opts.timeout > Date.now() - start) {
          throw new Error('timeout')
        }

        // eslint-disable-next-line no-await-in-loop
        await timeout(50)
      }
    }
    if (name === 'doWorkShortPingTime') {
      this.busy = true
      await timeout(50)
      this.busy = false
      await timeout(50)
      this.busy = true
      await timeout(50)
      this.busy = false
      await timeout(50)
      this.busy = true
      await timeout(50)
      this.busy = false
    }

    if (name === 'doWorkLongPingTime') {
      this.busy = true
      await timeout(500)
      this.busy = false
      await timeout(500)
      this.busy = true
      await timeout(500)
      this.busy = false
    }
    if (name === 'MockRenderTimeout') {
      this.busy = true
      await timeout(10000)
      this.busy = false
    }

    if (name === 'MockRenderShort') {
      this.busy = true
      await timeout(100)
      this.busy = false
    }
  }
}
test('watch worker with long ping, generates timeout', async () => {
  const worker = new MockWorkerHandle()

  try {
    const workerWatcher = watchWorker(worker, 200)
    const result = worker.call('doWorkLongPingTime')
    await Promise.race([result, workerWatcher])
  } catch (e) {
    expect(e.message).toMatch(/timeout/)
  }
})

test('watch worker generates multiple pings', async () => {
  const worker = new MockWorkerHandle()
  const workerWatcher = watchWorker(worker, 200)
  const result = worker.call('doWorkShortPingTime')
  await Promise.race([result, workerWatcher])
})

class MockRpcDriver extends BaseRpcDriver {
  maxPingTime = 1000

  workerCheckFrequency = 500

  makeWorker() {
    return new MockWorkerHandle()
  }
}

export class MockRendererTimeout extends RpcMethodType {
  name = 'MockRenderTimeout'
}

export class MockRendererShort extends RpcMethodType {
  name = 'MockRenderShort'
}

test('test RPC driver operation timeout and worker replace', async () => {
  console.warn = jest.fn()
  expect.assertions(1)
  const driver = new MockRpcDriver()
  const pluginManager = new PluginManager()

  pluginManager.addRpcMethod(() => new MockRendererTimeout(pluginManager))
  pluginManager.addRpcMethod(() => new MockRendererShort(pluginManager))
  pluginManager.createPluggableElements()
  try {
    await driver.call(pluginManager, 'sessionId', 'MockRenderTimeout', {}, {})
  } catch (e) {
    expect(e.message).toMatch(/operation timed out/)
  }
  await driver.call(pluginManager, 'sessionId', 'MockRenderShort', {}, {})
})
