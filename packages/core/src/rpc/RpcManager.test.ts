import PluginManager from '../PluginManager.ts'
import BaseRpcDriver from './BaseRpcDriver.ts'
import RpcManager from './RpcManager.ts'

import type { WorkerHandle } from './BaseRpcDriver.ts'

class NoopWorker implements WorkerHandle {
  destroy() {}
  async call() {
    return undefined
  }
}

class StubDriver extends BaseRpcDriver {
  name = 'StubDriver'
  freedSessions: string[] = []
  callLog: { sessionId: string; functionName: string }[] = []

  async makeWorker() {
    return new NoopWorker()
  }

  freeSession(sessionId: string) {
    this.freedSessions.push(sessionId)
    super.freeSession(sessionId)
  }

  async call(_pm: PluginManager, sessionId: string, functionName: string) {
    this.callLog.push({ sessionId, functionName })
    return undefined
  }
}

function makeManager() {
  const pluginManager = new PluginManager([]).createPluggableElements()
  const mainConfig = RpcManager.configSchema.create({
    defaultDriver: 'StubDriver',
    drivers: {
      StubDriver: { type: 'WebWorkerRpcDriver' },
    },
  })
  const manager = new RpcManager(pluginManager, mainConfig, {
    StubDriver: {},
  })
  const driver = new StubDriver({
    config: mainConfig.drivers.get('StubDriver')!,
  })
  manager.registerDriverFactory('StubDriver', () => driver)
  return { manager, driver }
}

describe('RpcManager session lifecycle', () => {
  test('calls driver.freeSession after CoreFreeResources', async () => {
    const { manager, driver } = makeManager()
    await manager.call('mySession', 'CoreFreeResources', {})
    expect(driver.freedSessions).toEqual(['mySession'])
  })

  test('does not call driver.freeSession after a non-free call', async () => {
    const { manager, driver } = makeManager()
    await manager.call('mySession', 'CoreGetRegions', { adapterConfig: {} })
    expect(driver.freedSessions).toEqual([])
  })

  test('calls freeSession even when the underlying call rejects', async () => {
    const { manager, driver } = makeManager()
    driver.call = async () => {
      throw new Error('rpc failed')
    }
    await expect(
      manager.call('s', 'CoreFreeResources', {} as any),
    ).rejects.toThrow('rpc failed')
    expect(driver.freedSessions).toEqual(['s'])
  })
})

describe('RpcManager driver registry', () => {
  test('throws on unregistered driver', () => {
    const { manager } = makeManager()
    expect(() => manager.getDriver('NonExistentDriver')).toThrow(
      /not registered/,
    )
  })

  test('caches driver instances', () => {
    const { manager } = makeManager()
    const a = manager.getDriver('StubDriver')
    const b = manager.getDriver('StubDriver')
    expect(a).toBe(b)
  })
})
