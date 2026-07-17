import WorkerPoolRpcDriver from './WorkerPoolRpcDriver.ts'
import rpcConfigSchema from './configSchema.ts'

import type { WorkerHandle } from './WorkerPoolRpcDriver.ts'
import type PluginManager from '../PluginManager.ts'

function makeConfig(overrides: { workerCount?: number } = {}) {
  return rpcConfigSchema.create(overrides)
}

class FakeWorker implements WorkerHandle {
  destroyed = false
  calls: { fn: string; args: unknown; opts?: unknown }[] = []
  private errorCallbacks: (() => void)[] = []

  destroy() {
    this.destroyed = true
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
