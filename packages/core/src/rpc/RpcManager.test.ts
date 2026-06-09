import PluginManager from '../PluginManager.ts'
import BaseRpcDriver from './BaseRpcDriver.ts'
import RpcManager from './RpcManager.ts'
import { AuthNeededError } from '../util/types/index.ts'

import type { WorkerHandle } from './BaseRpcDriver.ts'

// Stub of AppRootModel that satisfies isAppRootModel and records the ephemeral
// accounts withAuthRetry creates so dedup behavior is observable.
function withMockRootModel(manager: RpcManager) {
  const internetAccounts: { internetAccountId: string }[] = []
  ;(manager.pluginManager as { rootModel: unknown }).rootModel = {
    findAppropriateInternetAccount: () => undefined,
    internetAccounts,
    createEphemeralInternetAccount(internetAccountId: string) {
      const account = { internetAccountId }
      internetAccounts.push(account)
      return account
    },
  }
  return internetAccounts
}

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
  destroyed = false

  async makeWorker() {
    return new NoopWorker()
  }

  destroy() {
    this.destroyed = true
    super.destroy()
  }

  freeSession(sessionId: string) {
    this.freedSessions.push(sessionId)
    super.freeSession(sessionId)
  }

  async call(
    _pm: PluginManager,
    sessionId: string,
    functionName: string,
  ): Promise<unknown> {
    this.callLog.push({ sessionId, functionName })
    return undefined
  }
}

function makeManager() {
  const pluginManager = new PluginManager([]).createPluggableElements()
  const mainConfig = RpcManager.configSchema.create({
    defaultDriver: 'StubDriver',
  })
  const manager = new RpcManager(pluginManager, mainConfig)
  const driver = new StubDriver({ config: mainConfig })
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

describe('RpcManager auth retry', () => {
  const url = 'https://example.com/data.bam'

  test('retries once after creating an ephemeral account on AuthNeededError', async () => {
    const { manager, driver } = makeManager()
    const accounts = withMockRootModel(manager)
    let calls = 0
    driver.call = async () => {
      calls++
      if (calls === 1) {
        throw new AuthNeededError('needs auth', url)
      }
      return 'ok'
    }
    await expect(
      manager.call('s', 'CoreGetRegions', { adapterConfig: {} }),
    ).resolves.toBe('ok')
    expect(calls).toBe(2)
    expect(accounts).toEqual([
      { internetAccountId: 'HTTPBasicInternetAccount-https://example.com' },
    ])
  })

  test('creates one shared account for concurrent same-origin auth failures', async () => {
    const { manager, driver } = makeManager()
    const accounts = withMockRootModel(manager)
    // mirrors reality: the call fails auth until an account exists, then the
    // retry's re-serialized args carry pre-auth and succeed
    driver.call = async () => {
      if (accounts.length === 0) {
        throw new AuthNeededError('needs auth', url)
      }
      return 'ok'
    }
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        manager.call('s', 'CoreGetRegions', { adapterConfig: {} }),
      ),
    )
    expect(results).toEqual(['ok', 'ok', 'ok', 'ok', 'ok'])
    expect(accounts).toHaveLength(1)
  })

  test('surfaces the error without retrying when no app root model', async () => {
    const { manager, driver } = makeManager()
    let calls = 0
    driver.call = async () => {
      calls++
      throw new AuthNeededError('needs auth', url)
    }
    await expect(
      manager.call('s', 'CoreGetRegions', { adapterConfig: {} }),
    ).rejects.toThrow('needs auth')
    expect(calls).toBe(1)
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

describe('RpcManager.destroy', () => {
  test('destroys every instantiated driver and clears the cache', () => {
    const { manager } = makeManager()
    let built = 0
    manager.registerDriverFactory('StubDriver', () => {
      built++
      return new StubDriver({ config: manager.mainConfiguration })
    })

    const driver = manager.getDriver('StubDriver') as StubDriver
    expect(built).toBe(1)
    expect(driver.destroyed).toBe(false)

    manager.destroy()
    expect(driver.destroyed).toBe(true)

    // cache was cleared, so the next getDriver builds a fresh, live instance
    const rebuilt = manager.getDriver('StubDriver') as StubDriver
    expect(built).toBe(2)
    expect(rebuilt).not.toBe(driver)
    expect(rebuilt.destroyed).toBe(false)
  })
})
