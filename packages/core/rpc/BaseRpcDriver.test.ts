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
    if (name === 'MockRender') {
      this.busy = true
      await timeout(10000)
      this.busy = false
    }
  }
}
test('watch worker with timeout', async () => {
  const worker = new MockWorkerHandle()

  try {
    const workerWatcher = watchWorker(worker, 200)
    worker.call('doWorkLongPingTime')
    await workerWatcher // should throw
  } catch (e) {
    expect(e.message).toMatch(/timeout/)
  }
})

test('watch worker without timeout', async () => {
  const worker = new MockWorkerHandle()
  const workerWatcher = watchWorker(worker, 200)

  await worker.call('doWorkShortPingTime')
})

class MockRpcDriver extends BaseRpcDriver {
  maxPingTime = 1000

  workerCheckFrequency = 500

  makeWorker() {
    return new MockWorkerHandle()
  }
}

export class MockRenderer extends RpcMethodType {
  name = 'MockRender'
}

test('base rpc driver', async () => {
  console.warn = jest.fn()
  const driver = new MockRpcDriver()
  const pluginManager = new PluginManager()

  pluginManager.addRpcMethod(() => new MockRenderer(pluginManager))
  pluginManager.createPluggableElements()
  try {
    await driver.call(pluginManager, 'sessionId', 'MockRender', {}, {})
  } catch (e) {
    expect(e.message).toMatch(/operation timed out/)
  }
})
