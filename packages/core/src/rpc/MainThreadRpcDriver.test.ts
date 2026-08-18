import RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
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

    // a real RpcMethodType rather than an object literal, because the driver
    // calls `invoke` — the base's entry point, which deserializes the arguments
    // before `execute` sees them. A duck-typed fake with only an `execute` on it
    // passes through none of that, which is the half worth testing.
    class SomeMethod extends RpcMethodType {
      name = 'SomeMethod'

      async serializeArguments(args: object) {
        return { ...args, serialized: true }
      }

      async execute(args: unknown) {
        executeArgs.push(args)
        return 'raw-result'
      }

      async deserializeReturn(ret: unknown) {
        return { deserialized: ret }
      }
    }
    const { driver, pluginManager } = makeDriver(
      new SomeMethod({} as PluginManager),
    )

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

  test('adds no statusCallback key when the caller passed none', async () => {
    const executeArgs: unknown[] = []
    class SomeMethod extends RpcMethodType {
      name = 'SomeMethod'

      async execute(args: unknown) {
        executeArgs.push(args)
        return 'raw-result'
      }
    }
    const { driver, pluginManager } = makeDriver(
      new SomeMethod({} as PluginManager),
    )

    await driver.call(pluginManager, 'sid', 'SomeMethod', { sessionId: 'sid' })

    // the worker answers this by minting no status channel, so wrapForRpc adds
    // no key; the two drivers have to hand `execute` the same bag
    expect(executeArgs[0]).not.toHaveProperty('statusCallback')
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
