import { createStopToken, stopStopToken } from '../util/stopToken.ts'
import BaseRpcDriver from './BaseRpcDriver.ts'
import rpcConfigSchema from './configSchema.ts'

import type PluginManager from '../PluginManager.ts'
import type RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
import type { StatusCallback } from '../util/progress.ts'

// captures exactly what the call() envelope hands to a driver's transport, so
// we can assert the serialize/statusCallback/deserialize behavior without any
// worker or in-band machinery
class CapturingDriver extends BaseRpcDriver {
  name = 'CapturingDriver'
  transportCalls: {
    rpcMethod: RpcMethodType
    serializedArgs: Record<string, unknown>
    statusCallback: StatusCallback | undefined
    options: Record<string, unknown>
  }[] = []

  constructor() {
    super({
      config: rpcConfigSchema.create({}),
    })
  }

  protected async transport(
    _pluginManager: PluginManager,
    _sessionId: string,
    rpcMethod: RpcMethodType,
    serializedArgs: Record<string, unknown>,
    statusCallback: StatusCallback | undefined,
    options: Record<string, unknown>,
  ) {
    this.transportCalls.push({
      rpcMethod,
      serializedArgs,
      statusCallback,
      options,
    })
    return { raw: serializedArgs }
  }
}

const rpcMethod = {
  name: 'SomeMethod',
  serializeArguments: async (args: Record<string, unknown>) => ({
    ...args,
    serialized: true,
  }),
  deserializeReturn: (ret: unknown) => ({ deserialized: ret }),
}
const pluginManager = {
  getRpcMethodType: () => rpcMethod,
} as unknown as PluginManager

describe('BaseRpcDriver.call envelope', () => {
  test('splits statusCallback out of the payload and passes it to transport', async () => {
    const driver = new CapturingDriver()
    const statusCallback = () => {}
    await driver.call(pluginManager, 'sid', 'SomeMethod', {
      sessionId: 'sid',
      data: 1,
      statusCallback,
    })
    const { serializedArgs, statusCallback: cb } = driver.transportCalls[0]!
    // statusCallback travels out-of-band, the rest is run through serialize
    expect(serializedArgs).toEqual({
      sessionId: 'sid',
      data: 1,
      serialized: true,
    })
    expect(cb).toBe(statusCallback)
  })

  test('deserializes the transport result before returning', async () => {
    const driver = new CapturingDriver()
    const result = await driver.call(pluginManager, 'sid', 'SomeMethod', {
      sessionId: 'sid',
    })
    expect(result).toEqual({
      deserialized: { raw: { sessionId: 'sid', serialized: true } },
    })
  })

  test('throws without a sessionId', async () => {
    const driver = new CapturingDriver()
    await expect(
      driver.call(pluginManager, '', 'SomeMethod', {}),
    ).rejects.toThrow('sessionId is required')
  })

  test('refuses to dispatch a call whose stop token is already stopped', async () => {
    const driver = new CapturingDriver()
    const stopToken = createStopToken()
    stopStopToken(stopToken)
    await expect(
      driver.call(pluginManager, 'sid', 'SomeMethod', {
        sessionId: 'sid',
        stopToken,
      }),
    ).rejects.toThrow('aborted')
    // nothing serialized, no worker woken, and no stop notification racing the
    // call it was meant to cancel
    expect(driver.transportCalls).toHaveLength(0)
  })

  test('refuses to dispatch when the stop lands during serialization', async () => {
    const driver = new CapturingDriver()
    const stopToken = createStopToken()
    // serializeArguments is where the refName map is resolved, so it is the one
    // long await in call(); a stop arriving here used to wake a worker anyway
    const slowMethod = {
      ...rpcMethod,
      serializeArguments: async (args: Record<string, unknown>) => {
        stopStopToken(stopToken)
        return { ...args, serialized: true }
      },
    }
    await expect(
      driver.call(
        { getRpcMethodType: () => slowMethod } as unknown as PluginManager,
        'sid',
        'SomeMethod',
        { sessionId: 'sid', stopToken },
      ),
    ).rejects.toThrow('aborted')
    expect(driver.transportCalls).toHaveLength(0)
  })

  test('dispatches normally for a live stop token', async () => {
    const driver = new CapturingDriver()
    await driver.call(pluginManager, 'sid', 'SomeMethod', {
      sessionId: 'sid',
      stopToken: createStopToken(),
    })
    expect(driver.transportCalls).toHaveLength(1)
  })

  test('freeSession and destroy are no-ops by default', () => {
    const driver = new CapturingDriver()
    expect(() => {
      driver.freeSession('sid')
      driver.destroy()
    }).not.toThrow()
  })
})
