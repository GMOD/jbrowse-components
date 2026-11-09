import Plugin from '../Plugin.ts'
import PluginManager from '../PluginManager.ts'
import RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
import { AuthNeededError } from '../util/types/index.ts'
import RpcManager from './RpcManager.ts'

// Stub of AppRootModel that satisfies isAppRootModel and records the ephemeral
// accounts withAuthRetry creates so dedup behavior is observable.
function withMockRootModel(pluginManager: PluginManager) {
  const internetAccounts: { internetAccountId: string }[] = []
  ;(pluginManager as { rootModel: unknown }).rootModel = {
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
  driver.call = async (sessionId, functionName, args) => {
    callLog.push({ sessionId, functionName, args })
    return undefined
  }
  driver.freeSession = async sessionId => {
    freedSessions.push(sessionId)
  }
  return { manager, driver, callLog, freedSessions, pluginManager }
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

  test("a free lands after the session's calls in flight, an auth retry included, and waits on no other session's", async () => {
    const { manager, driver, freedSessions, pluginManager } = makeManager()
    withMockRootModel(pluginManager)
    const events: string[] = []
    let finishRetry = () => {}
    const retrying = new Promise<void>(resolve => {
      finishRetry = resolve
    })
    let attempts = 0
    driver.call = async sessionId => {
      if (sessionId === 'closed') {
        attempts++
        if (attempts === 1) {
          throw new AuthNeededError('needs auth', 'https://example.com/a.bam')
        }
        await retrying
        events.push('retry landed')
      }
      return undefined
    }
    driver.freeSession = async sessionId => {
      freedSessions.push(sessionId)
      events.push(`free ${sessionId}`)
    }

    const straggler = manager.call('closed', 'CoreGetRegions', {
      adapterConfig: {},
    })
    const other = manager.call('open', 'CoreGetRegions', { adapterConfig: {} })
    await manager.freeSession('unrelated')
    const freeing = manager.freeSession('closed')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(attempts).toBe(2)
    expect(events).toEqual(['free unrelated'])

    finishRetry()
    await Promise.all([straggler, other, freeing])
    expect(events).toEqual(['free unrelated', 'retry landed', 'free closed'])
  })

  test('a session reclaimed while its calls drain is not freed', async () => {
    const { manager, driver, freedSessions } = makeManager()
    let finish = () => {}
    driver.call = () =>
      new Promise(resolve => {
        finish = () => {
          resolve(undefined)
        }
      })
    const slow = manager.call('s', 'CoreGetRegions', { adapterConfig: {} })
    let claimed = false
    const freeing = manager.freeSession('s', () => !claimed)
    claimed = true
    finish()
    await Promise.all([slow, freeing])
    expect(freedSessions).toEqual([])
  })

  test('a call issued while a free drains is waited on too', async () => {
    const { manager, driver, freedSessions } = makeManager()
    const events: string[] = []
    const finishers: (() => void)[] = []
    driver.call = () =>
      new Promise(resolve => {
        finishers.push(() => {
          events.push('call landed')
          resolve(undefined)
        })
      })
    driver.freeSession = async sessionId => {
      freedSessions.push(sessionId)
      events.push('free')
    }
    const first = manager.call('s', 'CoreGetRegions', { adapterConfig: {} })
    const freeing = manager.freeSession('s')
    await new Promise(resolve => setTimeout(resolve, 0))
    const second = manager.call('s', 'CoreGetRegions', { adapterConfig: {} })
    await new Promise(resolve => setTimeout(resolve, 0))
    finishers[0]!()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(events).toEqual(['call landed'])
    finishers[1]!()
    await Promise.all([first, second, freeing])
    expect(events).toEqual(['call landed', 'call landed', 'free'])
  })
})

describe('RpcManager auth retry', () => {
  const url = 'https://example.com/data.bam'

  test('retries once after creating an ephemeral account on AuthNeededError', async () => {
    const { manager, driver, pluginManager } = makeManager()
    const accounts = withMockRootModel(pluginManager)
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
    const { manager, driver, pluginManager } = makeManager()
    const accounts = withMockRootModel(pluginManager)
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

  // `driverName` is what the About widget and the error-stack dialog print, and
  // both used to re-derive it from two public fields this getter replaced
  test('the host default applies when the config names no driver', () => {
    const pluginManager = new PluginManager([]).createPluggableElements()
    const manager = new RpcManager(
      pluginManager,
      RpcManager.configSchema.create({}),
      { defaultDriverName: 'MainThreadRpcDriver' },
    )
    expect(manager.driverName).toBe('MainThreadRpcDriver')
    expect(manager.getDriver().name).toBe('MainThreadRpcDriver')
  })

  test('the config overrides the host default', () => {
    const pluginManager = new PluginManager([]).createPluggableElements()
    const manager = new RpcManager(
      pluginManager,
      RpcManager.configSchema.create({ defaultDriver: 'MainThreadRpcDriver' }),
      { defaultDriverName: 'WebWorkerRpcDriver' },
    )
    expect(manager.driverName).toBe('MainThreadRpcDriver')
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
// disagreed — WebWorkerRpcDriver spread options over its own arguments and
// honored a statusCallback there, MainThreadRpcDriver ignored `opts` entirely —
// so the same call had a working progress bar under a worker and a silent one
// on the main thread.
describe('RpcManager: the handles are args, and every method takes them', () => {
  test('forwards both handles to the driver, for a method whose registry entry declares neither', async () => {
    const { manager, callLog } = makeManager()
    const statusCallback = () => {}
    const { signal } = new AbortController()
    // CoreGetRegions declares only `adapterConfig`. Passing the handles anyway
    // is the point: they are part of RpcCallArgs, not of the entry, so no
    // method can be uncancellable or silent by having omitted them.
    await manager.call('s', 'CoreGetRegions', {
      adapterConfig: {},
      signal,
      statusCallback,
    })
    const [entry] = callLog
    expect(entry?.args.statusCallback).toBe(statusCallback)
    expect(entry?.args.signal).toBe(signal)
    expect(entry?.args.sessionId).toBe('s')
  })
})

class Echo extends RpcMethodType {
  name = 'Echo'

  async execute(args: { value?: unknown }) {
    return args.value
  }
}

class EchoPlugin extends Plugin {
  name = 'EchoPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addRpcMethod(pm => new Echo(pm))
  }
}

// a stand-in for the `Worker` the real boot handshake drives
class FakeWorker extends EventTarget {
  terminated = false

  postMessage() {}

  terminate() {
    this.terminated = true
  }
}

const echo: string = 'Echo'

function makeWorkerManager(
  makeWorkerInstance: () => Worker | Promise<Worker>,
  fallBackToMainThread = true,
) {
  const pluginManager = new PluginManager([
    new EchoPlugin(),
  ]).createPluggableElements()
  return new RpcManager(pluginManager, RpcManager.configSchema.create({}), {
    makeWorkerInstance,
    defaultDriverName: 'WebWorkerRpcDriver',
    fallBackToMainThread,
  })
}

const tick = () =>
  new Promise(resolve => {
    setTimeout(resolve, 0)
  })

describe('RpcManager falls back to the main thread when its worker cannot boot', () => {
  let warn: jest.SpyInstance
  let error: jest.SpyInstance
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    // WebWorkerHandle logs the worker's own error event
    error = jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
    error.mockRestore()
  })

  test('a call in flight when the worker posts a boot error succeeds on the main thread', async () => {
    const worker = new FakeWorker()
    const manager = makeWorkerManager(() => worker as unknown as Worker)
    const call = manager.call('s', echo, { value: 'first' })
    await tick()
    worker.dispatchEvent(
      new MessageEvent('message', {
        data: {
          message: 'error',
          error: { name: 'Error', message: 'plugin blew up' },
        },
      }),
    )

    await expect(call).resolves.toBe('first')
    expect(worker.terminated).toBe(true)
    expect(manager.driverName).toBe('MainThreadRpcDriver')
    expect(manager.getDriver().name).toBe('MainThreadRpcDriver')
    await expect(manager.call('s', echo, { value: 'second' })).resolves.toBe(
      'second',
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toMatch(/worker failed to start/)
  })

  test('so does one when the worker script fails to load', async () => {
    const worker = new FakeWorker()
    const manager = makeWorkerManager(() => worker as unknown as Worker)
    const call = manager.call('s', echo, { value: 'v' })
    await tick()
    worker.dispatchEvent(new ErrorEvent('error', { message: 'not found' }))

    await expect(call).resolves.toBe('v')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('and one whose worker module failed to import', async () => {
    const manager = makeWorkerManager(() =>
      Promise.reject(new Error('chunk failed')),
    )

    await expect(manager.call('s', echo, { value: 'v' })).resolves.toBe('v')
    expect(manager.driverName).toBe('MainThreadRpcDriver')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('a warm-up that failed sends the first call straight to the main thread', async () => {
    let made = 0
    const manager = makeWorkerManager(() => {
      made++
      throw new Error('blocked')
    })
    manager.warmUp()
    await tick()

    await expect(manager.call('s', echo, { value: 'v' })).resolves.toBe('v')
    expect(made).toBe(1)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('a call that fails on a worker that booted is not retried', async () => {
    const worker = new FakeWorker()
    const manager = makeWorkerManager(() => worker as unknown as Worker)
    const call = manager.call('s', echo, { value: 'v' })
    await tick()
    worker.dispatchEvent(
      new MessageEvent('message', { data: { message: 'ready' } }),
    )
    await tick()
    manager.getDriver().destroy()

    await expect(call).rejects.toThrow(/terminated/)
    expect(manager.driverName).toBe('WebWorkerRpcDriver')
    expect(warn).not.toHaveBeenCalled()
  })

  test('only when asked: web and desktop keep the pool, and the call fails', async () => {
    const worker = new FakeWorker()
    const manager = makeWorkerManager(() => worker as unknown as Worker, false)
    const call = manager.call('s', echo, { value: 'v' })
    await tick()
    worker.dispatchEvent(new ErrorEvent('error', { message: 'not found' }))

    await expect(call).rejects.toThrow()
    expect(manager.driverName).toBe('WebWorkerRpcDriver')
    expect(manager.getDriver().name).toBe('WebWorkerRpcDriver')
    expect(warn).not.toHaveBeenCalled()
  })
})
