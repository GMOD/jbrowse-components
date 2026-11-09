import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

import { embeddedRpcOptions } from './pluginInput.ts'

import type { RpcManagerOptions } from '@jbrowse/core/rpc/RpcManager'

class BundledPlugin extends Plugin {
  name = 'BundledPlugin'

  install() {}
}

const record = {
  plugin: BundledPlugin,
  definition: { name: 'BundledPlugin', esmUrl: 'https://example.com/p.js' },
}

class FakeWorker {}
const builtWorker = new FakeWorker()

function options(plugins: Parameters<typeof embeddedRpcOptions>[0]['plugins']) {
  return embeddedRpcOptions({
    plugins,
    loadWorkerModule: async () => ({
      default: () => builtWorker as unknown as Worker,
    }),
  })
}

function driverOf(rpcManagerOptions: RpcManagerOptions) {
  const pluginManager = new PluginManager([]).createPluggableElements()
  return new RpcManager(
    pluginManager,
    RpcManager.configSchema.create({}),
    rpcManagerOptions,
  ).driverName
}

let warn: jest.SpyInstance
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
})

describe('with a Worker to build', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'Worker', {
      value: FakeWorker,
      configurable: true,
    })
  })
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'Worker')
  })

  test('no plugins run RPC in the product worker', async () => {
    const opts = options([])
    expect(opts.defaultDriverName).toBe('WebWorkerRpcDriver')
    expect(opts.fallBackToMainThread).toBe(true)
    expect(await opts.makeWorkerInstance?.()).toBe(builtWorker)
  })

  test('loadPlugins records run it there too', () => {
    expect(options([record]).defaultDriverName).toBe('WebWorkerRpcDriver')
  })

  test('a bare plugin class keeps it on the main thread, silently', () => {
    const opts = options([record, BundledPlugin])
    expect(opts.makeWorkerInstance).toBeUndefined()
    const pluginManager = new PluginManager([]).createPluggableElements()
    const manager = new RpcManager(
      pluginManager,
      RpcManager.configSchema.create({}),
      opts,
    )
    manager.getDriver()
    expect(manager.driverName).toBe('MainThreadRpcDriver')
    expect(warn).not.toHaveBeenCalled()
  })

  test("the caller's own factory wins, bare class or not", () => {
    const makeWorkerInstance = () => builtWorker as unknown as Worker
    const opts = embeddedRpcOptions({
      plugins: [BundledPlugin],
      makeWorkerInstance,
      loadWorkerModule: async () => ({ default: makeWorkerInstance }),
    })
    expect(opts.makeWorkerInstance).toBe(makeWorkerInstance)
    expect(opts.fallBackToMainThread).toBe(true)
    expect(driverOf(opts)).toBe('WebWorkerRpcDriver')
  })
})

test('with no Worker at all, the main thread, and no warning', () => {
  expect(typeof Worker).toBe('undefined')
  for (const plugins of [[], [BundledPlugin]]) {
    const opts = options(plugins)
    expect(opts.makeWorkerInstance).toBeUndefined()
    const pluginManager = new PluginManager([]).createPluggableElements()
    const manager = new RpcManager(
      pluginManager,
      RpcManager.configSchema.create({}),
      opts,
    )
    manager.getDriver()
    expect(manager.driverName).toBe('MainThreadRpcDriver')
  }
  expect(warn).not.toHaveBeenCalled()
})
