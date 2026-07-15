import MainThreadRpcDriver from './MainThreadRpcDriver.ts'
import rpcConfigSchema from './configSchema.ts'

import type PluginManager from '../PluginManager.ts'

function makeDriver(rpcMethod: unknown) {
  const driver = new MainThreadRpcDriver({ config: rpcConfigSchema.create({}) })
  const pluginManager = {
    getRpcMethodType: () => rpcMethod,
  } as unknown as PluginManager
  return { driver, pluginManager }
}

describe('MainThreadRpcDriver', () => {
  test('executes in-band, re-attaching statusCallback to the serialized args', async () => {
    const executeArgs: unknown[] = []
    const statusCallback = () => {}
    const rpcMethod = {
      name: 'SomeMethod',
      serializeArguments: async (args: Record<string, unknown>) => ({
        ...args,
        serialized: true,
      }),
      execute: async (args: unknown) => {
        executeArgs.push(args)
        return 'raw-result'
      },
      deserializeReturn: (ret: unknown) => ({ deserialized: ret }),
    }
    const { driver, pluginManager } = makeDriver(rpcMethod)

    const result = await driver.call(pluginManager, 'sid', 'SomeMethod', {
      sessionId: 'sid',
      data: 1,
      statusCallback,
    })

    // execute sees the serialized payload with statusCallback wired back in
    expect(executeArgs[0]).toEqual({
      sessionId: 'sid',
      data: 1,
      serialized: true,
      statusCallback,
    })
    // and the return travels back through deserializeReturn
    expect(result).toEqual({ deserialized: 'raw-result' })
  })

  test('never touches a worker pool (no makeWorker)', () => {
    // MainThreadRpcDriver intentionally has no makeWorker; freeSession/destroy
    // are inherited no-ops
    const { driver } = makeDriver({})
    expect(
      (driver as unknown as { makeWorker?: unknown }).makeWorker,
    ).toBeUndefined()
    expect(() => {
      driver.freeSession('sid')
      driver.destroy()
    }).not.toThrow()
  })
})
