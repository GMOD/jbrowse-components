import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

import { embeddedRpcOptions } from './pluginInput.ts'

import type { RpcManagerOptions } from '@jbrowse/core/rpc/RpcManager'

function managerOf(rpcManagerOptions: RpcManagerOptions) {
  const pluginManager = new PluginManager([]).createPluggableElements()
  return new RpcManager(
    pluginManager,
    RpcManager.configSchema.create({}),
    rpcManagerOptions,
  )
}

test('with no factory, RPC runs on the main thread, silently', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const opts = embeddedRpcOptions()
  expect(opts).toEqual({})
  const manager = managerOf(opts)
  manager.getDriver()
  expect(manager.driverName).toBe('MainThreadRpcDriver')
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
})

test("the host's factory runs RPC in its worker, falling back if it cannot boot", () => {
  const makeWorkerInstance = () => new Worker('rpcWorker.js')
  const opts = embeddedRpcOptions(makeWorkerInstance)
  expect(opts.makeWorkerInstance).toBe(makeWorkerInstance)
  expect(opts.fallBackToMainThread).toBe(true)
  expect(managerOf(opts).driverName).toBe('WebWorkerRpcDriver')
})
