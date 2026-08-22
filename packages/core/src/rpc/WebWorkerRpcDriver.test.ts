import { stopStopToken } from '../util/stopToken.ts'
import WebWorkerRpcDriver from './WebWorkerRpcDriver.ts'
import rpcConfigSchema from './configSchema.ts'

import type PluginManager from '../PluginManager.ts'
import type { WorkerHandle } from './WebWorkerRpcDriver.ts'

function makeConfig(overrides: { workerCount?: number } = {}) {
  return rpcConfigSchema.create(overrides)
}

// the driver holds a plugin manager now; the pool tests only need the two
// members it reaches for
const rpcMethod = {
  name: 'SomeMethod',
  serializeArguments: async (args: unknown) => args,
  deserializeReturn: (ret: unknown) => ret,
}
const fakePluginManager = {
  getRpcMethodType: () => rpcMethod,
  evaluateExtensionPoint: (_name: string, worker: unknown) => worker,
} as unknown as PluginManager

class FakeHandle implements WorkerHandle {
  destroyed = false
  calls: { fn: string; args: unknown; opts?: unknown }[] = []
  stopped: string[] = []
  private errorCallbacks: (() => void)[] = []

  destroy() {
    this.destroyed = true
  }

  notifyStopToken(id: string) {
    this.stopped.push(id)
  }

  onError(callback: () => void) {
    this.errorCallbacks.push(callback)
  }

  // test hook: simulate an uncaught worker error reaching the handle
  triggerError() {
    for (const cb of this.errorCallbacks) {
      cb()
    }
  }

  async call(fn: string, args?: unknown, opts?: unknown) {
    this.calls.push({ fn, args, opts })
    return args
  }
}

// the pool half of the driver, with `makeWorker` standing in for the boot
// handshake the second half of this file drives for real
class TestDriver extends WebWorkerRpcDriver {
  name = 'TestDriver'
  workers: FakeHandle[] = []
  failNextMake = false

  constructor(config = makeConfig(), pluginManager = fakePluginManager) {
    super(pluginManager, config, {
      makeWorkerInstance: () => {
        throw new Error('makeWorker is overridden; no Worker is created')
      },
      plugins: [],
      windowHref: '',
      numberGrouping: true,
    })
  }

  override async makeWorker() {
    if (this.failNextMake) {
      this.failNextMake = false
      throw new Error('boom')
    }
    const w = new FakeHandle()
    this.workers.push(w)
    return w
  }
}

describe('WebWorkerRpcDriver pool dispatch', () => {
  test('extracts statusCallback out of the serialized payload, passes it via options', async () => {
    const driver = new TestDriver()
    const statusCallback = () => {}
    const callArgs: Record<string, unknown> & { statusCallback: () => void } = {
      sessionId: 'sid',
      data: 1,
      statusCallback,
    }
    await driver.call('sid', 'SomeMethod', callArgs)
    const { args, opts } = driver.workers[0]!.calls[0]!
    // statusCallback never reaches the serialized payload...
    expect(args).toEqual({ sessionId: 'sid', data: 1 })
    expect((args as Record<string, unknown>).statusCallback).toBeUndefined()
    // ...it travels out-of-band via the worker call options instead
    expect((opts as { statusCallback: unknown }).statusCallback).toBe(
      statusCallback,
    )
  })
})

describe('WebWorkerRpcDriver pool worker assignment', () => {
  test('assigns sessions round-robin across the pool', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 3 }))
    const w1 = await driver.getWorker('s1')
    const w2 = await driver.getWorker('s2')
    const w3 = await driver.getWorker('s3')
    const w4 = await driver.getWorker('s4')
    // s1 and s4 should reuse the same worker after wrapping the pool
    expect(w1).toBe(w4)
    expect(w1).not.toBe(w2)
    expect(w2).not.toBe(w3)
  })

  test('repeated calls for the same session return the same worker', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 3 }))
    const first = await driver.getWorker('sticky')
    const second = await driver.getWorker('sticky')
    expect(first).toBe(second)
  })

  test('freeSession drops the assignment so the next assign picks a fresh slot', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 3 }))
    await driver.getWorker('s1')
    await driver.getWorker('s2')

    await driver.freeSession('s1')
    // re-requesting s1 should now get a new round-robin slot, not the original
    const reassigned = await driver.getWorker('s1')
    const next = await driver.getWorker('s3')
    expect(reassigned).not.toBe(next)
  })
})

describe('WebWorkerRpcDriver pool freeSession', () => {
  test('frees on the worker the session was assigned to, and only there', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 3 }))
    // round-robin, and driver.workers is in boot order: s1 is slot 0, s2 slot 1
    await driver.getWorker('s1')
    await driver.getWorker('s2')

    await driver.freeSession('s1')

    expect(driver.workers[0]!.calls).toEqual([
      { fn: 'CoreFreeResources', args: { sessionId: 's1' }, opts: undefined },
    ])
    expect(driver.workers[1]!.calls).toEqual([])
  })

  test('boots no worker for a session that never dispatched anything', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 3 }))
    await driver.freeSession('never-used')
    expect(driver.workers).toEqual([])
  })

  test('a slot still booting frees once it lands', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 1 }))
    const booting = driver.getWorker('s1')
    await driver.freeSession('s1')
    await booting
    expect(driver.workers[0]!.calls.map(c => c.fn)).toEqual([
      'CoreFreeResources',
    ])
  })

  test('a slot whose worker failed to boot frees nothing and does not throw', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 1 }))
    driver.failNextMake = true
    await expect(driver.getWorker('s1')).rejects.toThrow('boom')
    await expect(driver.freeSession('s1')).resolves.toBeUndefined()
  })
})

describe('WebWorkerRpcDriver pool destroy', () => {
  test('terminates every booted worker in the pool', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 3 }))
    await driver.getWorker('s1')
    await driver.getWorker('s2')
    await driver.getWorker('s3')
    expect(driver.workers).toHaveLength(3)

    driver.destroy()
    await Promise.resolve()
    expect(driver.workers.every(w => w.destroyed)).toBe(true)
  })

  test('does not boot workers that were never requested', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 3 }))
    await driver.getWorker('s1')

    driver.destroy()
    await Promise.resolve()
    // only the one lazily-booted worker was ever created
    expect(driver.workers).toHaveLength(1)
  })

  test('a failed worker boot does not throw on destroy', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 1 }))
    driver.failNextMake = true
    await expect(driver.getWorker('s')).rejects.toThrow('boom')
    expect(() => {
      driver.destroy()
    }).not.toThrow()
  })

  // ADR-069 destroys the tree a task after `detach()` terminates the pool, so
  // "after destroy" is a real moment in every session switch; `getWorkerPool`'s
  // `??=` used to answer it with a second pool. ADR-086.
  test('destroy is terminal: a later call gets an error, not a second pool', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 1 }))
    await driver.getWorker('s')
    driver.destroy()

    await expect(driver.getWorker('s')).rejects.toThrow(/destroyed/)
    expect(driver.workers).toHaveLength(1)
  })

  test('a booted pool hears a stopped token, and stops hearing on destroy', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 1 }))
    await driver.getWorker('s')
    // the boot promise the notify routes through has to settle first
    await Promise.resolve()

    // a string token, not createStopToken(): jsdom has SharedArrayBuffer, and a
    // SAB token cancels through shared memory with no broadcast to make. The
    // string path is the one every deployment without cross-origin isolation
    // takes, which is all of ours.
    stopStopToken('stop-1')
    await Promise.resolve()
    expect(driver.workers[0]!.stopped).toEqual(['stop-1'])

    driver.destroy()
    stopStopToken('stop-2')
    await Promise.resolve()
    // the registration goes with the pool, so a destroyed driver leaves nothing
    // behind in the module-global broadcaster set
    expect(driver.workers[0]!.stopped).toEqual(['stop-1'])
  })
})

describe('WebWorkerRpcDriver pool LazyWorker retry on failure', () => {
  test('a failed makeWorker call lets a subsequent call retry', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 1 }))
    driver.failNextMake = true
    await expect(driver.getWorker('s')).rejects.toThrow('boom')
    // second call should succeed because the failure was cleared
    const w = await driver.getWorker('s')
    expect(w).toBeDefined()
  })

  test('concurrent callers share the in-flight worker promise', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 1 }))
    const [a, b] = await Promise.all([
      driver.getWorker('s'),
      driver.getWorker('s'),
    ])
    expect(a).toBe(b)
    // only one worker was actually created
    expect(driver.workers).toHaveLength(1)
  })

  test('an uncaught worker error drops the slot so the next call re-boots', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 1 }))
    const first = await driver.getWorker('s')
    // let the .then() that registers the onError handler run
    await Promise.resolve()

    ;(first as FakeHandle).triggerError()

    const second = await driver.getWorker('s')
    // the dead worker was terminated and a fresh one booted in its place
    expect((first as FakeHandle).destroyed).toBe(true)
    expect(second).not.toBe(first)
    expect((second as FakeHandle).destroyed).toBe(false)
    expect(driver.workers).toHaveLength(2)
  })
})

describe('WebWorkerRpcDriver pool Core-extendWorker', () => {
  // counts the fold, and hands back a distinct wrapper so a per-call fire also
  // shows up as the extended handle changing identity between calls
  function countingPluginManager() {
    let fired = 0
    return {
      fired: () => fired,
      pluginManager: {
        getRpcMethodType: () => rpcMethod,
        evaluateExtensionPoint: (_name: string, worker: WorkerHandle) => {
          fired++
          return {
            ...worker,
            call: (...callArgs: Parameters<WorkerHandle['call']>) =>
              worker.call(...callArgs),
          }
        },
      } as unknown as PluginManager,
    }
  }

  test('fires once per booted worker, not once per call', async () => {
    const { fired, pluginManager } = countingPluginManager()
    const driver = new TestDriver(makeConfig({ workerCount: 1 }), pluginManager)

    await driver.call('s', 'SomeMethod', { sessionId: 's' })
    await driver.call('s', 'SomeMethod', { sessionId: 's' })
    await driver.call('s', 'SomeMethod', { sessionId: 's' })

    expect(fired()).toBe(1)
    // all three calls still reached the underlying worker through the wrapper
    expect(driver.workers[0]!.calls).toHaveLength(3)
  })

  test('a re-booted slot is extended again', async () => {
    const { fired, pluginManager } = countingPluginManager()
    const driver = new TestDriver(makeConfig({ workerCount: 1 }), pluginManager)

    await driver.call('s', 'SomeMethod', { sessionId: 's' })
    // let the .then() that registers the onError handler run, then kill it
    await Promise.resolve()
    driver.workers[0]!.triggerError()

    await driver.call('s', 'SomeMethod', { sessionId: 's' })

    expect(driver.workers).toHaveLength(2)
    expect(fired()).toBe(2)
  })

  // `WorkerHandle` makes onError/notifyStopToken optional, so a wrapper that
  // spreads the handle and forwards `call` — the obvious way to write one, and
  // what countingPluginManager builds — carries neither. The pool therefore
  // drives the worker's life on the handle it booted rather than on whatever
  // comes back, or a dead worker is never noticed and the slot never re-boots.
  test('a wrapper that forwards only call still leaves the slot re-bootable', async () => {
    const { pluginManager } = countingPluginManager()
    const driver = new TestDriver(makeConfig({ workerCount: 1 }), pluginManager)

    await driver.call('s', 'SomeMethod', { sessionId: 's' })
    await Promise.resolve()
    expect(driver.workers[0]!.calls).toHaveLength(1)

    driver.workers[0]!.triggerError()
    await driver.call('s', 'SomeMethod', { sessionId: 's' })

    expect(driver.workers).toHaveLength(2)
    expect(driver.workers[0]!.destroyed).toBe(true)
  })

  test('each worker in the pool is extended on its own', async () => {
    const { fired, pluginManager } = countingPluginManager()
    const driver = new TestDriver(makeConfig({ workerCount: 2 }), pluginManager)

    await driver.call('s1', 'SomeMethod', { sessionId: 's1' })
    await driver.call('s2', 'SomeMethod', { sessionId: 's2' })
    await driver.call('s1', 'SomeMethod', { sessionId: 's1' })

    expect(driver.workers).toHaveLength(2)
    expect(fired()).toBe(2)
  })
})

// a stand-in for the `Worker` the real makeWorker boots
class FakeWorkerInstance extends EventTarget {
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
  const worker = new FakeWorkerInstance()
  const driver = new WebWorkerRpcDriver(
    fakePluginManager,
    rpcConfigSchema.create({}),
    {
      makeWorkerInstance: () => worker as unknown as Worker,
      plugins: [],
      windowHref: 'http://localhost/',
      numberGrouping: true,
    },
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
