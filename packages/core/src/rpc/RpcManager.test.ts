import PluginManager from '../PluginManager.ts'
import { AuthNeededError } from '../util/types/index.ts'
import RpcManager from './RpcManager.ts'

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

// The real MainThreadRpcDriver, with only its two outward-facing methods stood
// in for: there is no driver-factory seam to inject a whole fake through.
function makeManager(defaultDriver = 'MainThreadRpcDriver') {
  const pluginManager = new PluginManager([]).createPluggableElements()
  const mainConfig = RpcManager.configSchema.create({ defaultDriver })
  const manager = new RpcManager(pluginManager, mainConfig)
  const driver = manager.getDriver()
  const callLog: {
    sessionId: string
    functionName: string
    args: Record<string, unknown>
  }[] = []
  const freedSessions: string[] = []
  driver.call = async (_pm, sessionId, functionName, args) => {
    callLog.push({ sessionId, functionName, args })
    return undefined
  }
  driver.freeSession = async (_pm, sessionId) => {
    freedSessions.push(sessionId)
  }
  return { manager, driver, callLog, freedSessions }
}

describe('RpcManager session lifecycle', () => {
  test('freeSession reaches the driver that ran the session', async () => {
    const { manager, freedSessions } = makeManager()
    await manager.freeSession('mySession')
    expect(freedSessions).toEqual(['mySession'])
  })

  test('an ordinary call frees nothing', async () => {
    const { manager, freedSessions } = makeManager()
    await manager.call('mySession', 'CoreGetRegions', { adapterConfig: {} })
    expect(freedSessions).toEqual([])
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

describe('RpcManager driver resolution', () => {
  test('throws on a driver name nothing builds', () => {
    const pluginManager = new PluginManager([]).createPluggableElements()
    const manager = new RpcManager(
      pluginManager,
      RpcManager.configSchema.create({ defaultDriver: 'NonExistentDriver' }),
    )
    expect(() => manager.getDriver()).toThrow(/not registered/)
  })

  test('the driver is built once and kept', () => {
    const { manager } = makeManager()
    expect(manager.getDriver()).toBe(manager.getDriver())
  })

  test('the host default applies when the config names no driver', () => {
    const pluginManager = new PluginManager([]).createPluggableElements()
    const manager = new RpcManager(
      pluginManager,
      RpcManager.configSchema.create({}),
      { defaultDriverName: 'MainThreadRpcDriver' },
    )
    expect(manager.getDriver().name).toBe('MainThreadRpcDriver')
  })
})

// `detach()` destroys the manager and ADR-069 destroys the tree a task later,
// so "after destroy" is a real moment in every session switch rather than a
// misuse. ADR-086.
describe('RpcManager.destroy is terminal', () => {
  test('destroys the driver it built', () => {
    const { manager, driver } = makeManager()
    const destroy = jest.spyOn(driver, 'destroy')
    manager.destroy()
    expect(destroy).toHaveBeenCalled()
  })

  test('a later call throws instead of building a second driver', async () => {
    const { manager } = makeManager()
    manager.destroy()
    await expect(
      manager.call('s', 'CoreGetRegions', { adapterConfig: {} }),
    ).rejects.toThrow(/destroyed/)
    expect(() => manager.getDriver()).toThrow(/destroyed/)
  })

  // The destroy already freed strictly more than a free would: it terminated
  // the workers the adapter cache lived in.
  test('a later freeSession is silent, and builds nothing', async () => {
    const { manager, freedSessions } = makeManager()
    manager.destroy()
    await expect(manager.freeSession('s')).resolves.toBeUndefined()
    expect(freedSessions).toEqual([])
  })
})

// The handles ride `args`, for every method, and there is only the one
// position. They used to be accepted in an `opts` parameter as well and the two
// disagreed — WorkerPoolRpcDriver spread options over its own arguments and
// honored a statusCallback there, MainThreadRpcDriver ignored `opts` entirely —
// so the same call had a working progress bar under a worker and a silent one
// under the driver every embedded component defaults to.
describe('RpcManager: the handles are args, and every method takes them', () => {
  test('forwards both handles to the driver, for a method whose registry entry declares neither', async () => {
    const { manager, callLog } = makeManager()
    const statusCallback = () => {}
    const stopToken = 'tok'
    // CoreGetRegions declares only `adapterConfig`. Passing the handles anyway
    // is the point: they are part of RpcCallArgs, not of the entry, so no
    // method can be uncancellable or silent by having omitted them.
    await manager.call('s', 'CoreGetRegions', {
      adapterConfig: {},
      stopToken,
      statusCallback,
    })
    const [entry] = callLog
    expect(entry?.args.statusCallback).toBe(statusCallback)
    expect(entry?.args.stopToken).toBe(stopToken)
    expect(entry?.args.sessionId).toBe('s')
  })
})
