import { stopStopToken } from '../util/stopToken.ts'
import WorkerPoolRpcDriver from './WorkerPoolRpcDriver.ts'
import rpcConfigSchema from './configSchema.ts'

import type PluginManager from '../PluginManager.ts'
import type { WorkerHandle } from './WorkerPoolRpcDriver.ts'

function makeConfig(overrides: { workerCount?: number } = {}) {
  return rpcConfigSchema.create(overrides)
}

class FakeWorker implements WorkerHandle {
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

class TestDriver extends WorkerPoolRpcDriver {
  name = 'TestDriver'
  workers: FakeWorker[] = []
  failNextMake = false

  constructor(config = makeConfig()) {
    super({ config })
  }

  async makeWorker() {
    if (this.failNextMake) {
      this.failNextMake = false
      throw new Error('boom')
    }
    const w = new FakeWorker()
    this.workers.push(w)
    return w
  }
}

describe('WorkerPoolRpcDriver.call statusCallback handling', () => {
  // identity rpc method + minimal plugin manager so we can observe what the
  // driver hands the worker
  const rpcMethod = {
    name: 'SomeMethod',
    serializeArguments: async (args: unknown) => args,
    deserializeReturn: (ret: unknown) => ret,
  }
  const pluginManager = {
    getRpcMethodType: () => rpcMethod,
    evaluateExtensionPoint: (_name: string, worker: unknown) => worker,
  } as unknown as PluginManager

  test('extracts statusCallback out of the serialized payload, passes it via options', async () => {
    const driver = new TestDriver()
    const statusCallback = () => {}
    const callArgs: Record<string, unknown> & { statusCallback: () => void } = {
      sessionId: 'sid',
      data: 1,
      statusCallback,
    }
    await driver.call(pluginManager, 'sid', 'SomeMethod', callArgs)
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

describe('WorkerPoolRpcDriver worker assignment', () => {
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

    driver.freeSession('s1')
    // re-requesting s1 should now get a new round-robin slot, not the original
    const reassigned = await driver.getWorker('s1')
    const next = await driver.getWorker('s3')
    expect(reassigned).not.toBe(next)
  })
})

describe('WorkerPoolRpcDriver.destroy', () => {
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

  test('a fresh slot is assigned after destroy resets the pool', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 1 }))
    const before = await driver.getWorker('s')
    driver.destroy()
    const after = await driver.getWorker('s')
    expect(after).not.toBe(before)
    expect(driver.workers).toHaveLength(2)
    // the original worker was terminated, the replacement stays live
    expect(driver.workers[0]!.destroyed).toBe(true)
    expect(driver.workers[1]!.destroyed).toBe(false)
  })

  test('the pool built after a destroy still hears a stopped token', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 1 }))
    await driver.getWorker('s')
    driver.destroy()
    await driver.getWorker('s')
    // the boot promise the notify routes through has to settle first
    await Promise.resolve()

    // a string token, not createStopToken(): jsdom has SharedArrayBuffer, and a
    // SAB token cancels through shared memory with no broadcast to make. The
    // string path is the one every deployment without cross-origin isolation
    // takes, which is all of ours.
    const stopToken = 'stop-1'
    stopStopToken(stopToken)
    await Promise.resolve()

    // registered in the constructor, this was unregistered by destroy and never
    // renewed, so the second pool could not be cancelled at all — every stopped
    // fetch ran to completion with nothing failing
    expect(driver.workers[1]!.stopped).toEqual([stopToken])
  })
})

describe('WorkerPoolRpcDriver LazyWorker retry on failure', () => {
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

    ;(first as FakeWorker).triggerError()

    const second = await driver.getWorker('s')
    // the dead worker was terminated and a fresh one booted in its place
    expect((first as FakeWorker).destroyed).toBe(true)
    expect(second).not.toBe(first)
    expect((second as FakeWorker).destroyed).toBe(false)
    expect(driver.workers).toHaveLength(2)
  })
})

describe('WorkerPoolRpcDriver Core-extendWorker', () => {
  const rpcMethod = {
    name: 'SomeMethod',
    serializeArguments: async (args: unknown) => args,
    deserializeReturn: (ret: unknown) => ret,
  }

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
    const driver = new TestDriver(makeConfig({ workerCount: 1 }))
    const { fired, pluginManager } = countingPluginManager()

    await driver.call(pluginManager, 's', 'SomeMethod', { sessionId: 's' })
    await driver.call(pluginManager, 's', 'SomeMethod', { sessionId: 's' })
    await driver.call(pluginManager, 's', 'SomeMethod', { sessionId: 's' })

    expect(fired()).toBe(1)
    // all three calls still reached the underlying worker through the wrapper
    expect(driver.workers[0]!.calls).toHaveLength(3)
  })

  test('a re-booted slot is extended again', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 1 }))
    const { fired, pluginManager } = countingPluginManager()

    await driver.call(pluginManager, 's', 'SomeMethod', { sessionId: 's' })
    // let the .then() that registers the onError handler run, then kill it
    await Promise.resolve()
    driver.workers[0]!.triggerError()

    await driver.call(pluginManager, 's', 'SomeMethod', { sessionId: 's' })

    expect(driver.workers).toHaveLength(2)
    expect(fired()).toBe(2)
  })

  test('each worker in the pool is extended on its own', async () => {
    const driver = new TestDriver(makeConfig({ workerCount: 2 }))
    const { fired, pluginManager } = countingPluginManager()

    await driver.call(pluginManager, 's1', 'SomeMethod', { sessionId: 's1' })
    await driver.call(pluginManager, 's2', 'SomeMethod', { sessionId: 's2' })
    await driver.call(pluginManager, 's1', 'SomeMethod', { sessionId: 's1' })

    expect(driver.workers).toHaveLength(2)
    expect(fired()).toBe(2)
  })
})
