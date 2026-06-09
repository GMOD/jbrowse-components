import BaseRpcDriver from './BaseRpcDriver.ts'
import rpcConfigSchema from './configSchema.ts'

import type { WorkerHandle } from './BaseRpcDriver.ts'

function makeConfig(overrides: { workerCount?: number } = {}) {
  return rpcConfigSchema.create(overrides)
}

class FakeWorker implements WorkerHandle {
  destroyed = false
  calls: { fn: string; args: unknown }[] = []

  destroy() {
    this.destroyed = true
  }

  async call(fn: string, args?: unknown) {
    this.calls.push({ fn, args })
    return args
  }
}

class TestDriver extends BaseRpcDriver {
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

describe('BaseRpcDriver.filterArgs', () => {
  const driver = new TestDriver()

  test('strips functions from nested objects', () => {
    const out = driver.filterArgs({
      a: 1,
      fn: () => 0,
      nested: { b: () => 0, c: 2 },
    })
    expect(out).toEqual({ a: 1, nested: { c: 2 } })
  })

  test('strips Error instances from arrays and objects', () => {
    const out = driver.filterArgs([1, new Error('x'), 2])
    expect(out).toEqual([1, 2])
  })

  test('preserves primitives unchanged', () => {
    expect(driver.filterArgs(42)).toBe(42)
    expect(driver.filterArgs('hi')).toBe('hi')
    expect(driver.filterArgs(true)).toBe(true)
    expect(driver.filterArgs(null)).toBe(null)
    const u: unknown = undefined
    expect(driver.filterArgs(u)).toBeUndefined()
  })

  test('preserves Date instances (structured-clone handles them)', () => {
    const d = new Date(123456789)
    const out = driver.filterArgs({ when: d })
    expect(out.when).toBe(d)
    expect(out.when).toBeInstanceOf(Date)
  })

  test('preserves Map instances', () => {
    const m = new Map([['a', 1]])
    const out = driver.filterArgs({ m })
    expect(out.m).toBe(m)
    expect(out.m).toBeInstanceOf(Map)
  })

  test('preserves Set instances', () => {
    const s = new Set([1, 2, 3])
    const out = driver.filterArgs({ s })
    expect(out.s).toBe(s)
    expect(out.s).toBeInstanceOf(Set)
  })

  test('preserves ArrayBuffer and typed arrays', () => {
    const buf = new ArrayBuffer(8)
    const u8 = new Uint8Array([1, 2, 3])
    const out = driver.filterArgs({ buf, u8 })
    expect(out.buf).toBe(buf)
    expect(out.u8).toBe(u8)
  })

  test('preserves RegExp', () => {
    const re = /abc/g
    expect(driver.filterArgs({ re }).re).toBe(re)
  })

  test('returns undefined for a top-level function', () => {
    expect(driver.filterArgs(() => 1)).toBeUndefined()
  })
})

describe('BaseRpcDriver worker assignment', () => {
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

describe('BaseRpcDriver.destroy', () => {
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

describe('BaseRpcDriver LazyWorker retry on failure', () => {
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
})
