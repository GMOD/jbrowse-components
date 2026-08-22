import PluginManager from '../PluginManager.ts'
import RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
import BaseRpcDriver from './BaseRpcDriver.ts'

import type { StatusCallback } from '../util/progress.ts'

// `serializeArguments` is where the refName map is resolved, and resolving one
// downloads the adapter's index — for an in-memory adapter, the whole file. So
// the status handle has to still be on `args` at that point, and must not be on
// what reaches the worker, which is cloned and rejects functions.
//
// Both halves are one line in `BaseRpcDriver.call` and the tidy that breaks them
// looks like a simplification: destructuring the callback off before the call
// instead of off its result. That reads identically and silences every index
// download in the app, with nothing failing.

class RecordingMethod extends RpcMethodType {
  name = 'RecordingMethod'
  seenDuringSerialize: unknown

  override async serializeArguments(args: Record<string, unknown>) {
    this.seenDuringSerialize = args.statusCallback
    return super.serializeArguments(args)
  }

  async execute() {}
}

class CapturingDriver extends BaseRpcDriver {
  name = 'CapturingDriver'
  transported: Record<string, unknown> | undefined
  transportedStatusCallback: StatusCallback | undefined

  async makeWorker() {
    throw new Error('not used')
  }

  protected async transport(
    _sessionId: string,
    _rpcMethod: RpcMethodType,
    serializedArgs: Record<string, unknown>,
    statusCallback: StatusCallback | undefined,
  ) {
    this.transported = serializedArgs
    this.transportedStatusCallback = statusCallback
    return undefined
  }
}

function setup() {
  const pluginManager = new PluginManager()
  const method = new RecordingMethod(pluginManager)
  ;(pluginManager as { getRpcMethodType: unknown }).getRpcMethodType = () =>
    method
  const driver = new CapturingDriver(pluginManager, undefined as never)
  return { pluginManager, method, driver }
}

test('serializeArguments can see statusCallback', async () => {
  const { method, driver } = setup()
  const statusCallback = jest.fn()
  await driver.call('sess', 'RecordingMethod', {
    adapterConfig: {},
    statusCallback,
  })
  // The refName map resolution inside serialization reports through this. If it
  // is undefined here, every "Downloading index" goes nowhere.
  expect(method.seenDuringSerialize).toBe(statusCallback)
})

test('statusCallback does not reach the transport payload', async () => {
  const { driver } = setup()
  const statusCallback = jest.fn()
  await driver.call('sess', 'RecordingMethod', {
    adapterConfig: {},
    statusCallback,
  })
  // A function in here throws at the worker's postMessage clone.
  expect(driver.transported).not.toHaveProperty('statusCallback')
  // and it still reaches the transport out of band, which is how the worker's
  // own progress gets back
  expect(driver.transportedStatusCallback).toBe(statusCallback)
})

test('a call with no statusCallback carries no undefined key into the payload', async () => {
  const { driver } = setup()
  await driver.call('sess', 'RecordingMethod', {
    adapterConfig: {},
  })
  expect(driver.transported).not.toHaveProperty('statusCallback')
  expect(driver.transportedStatusCallback).toBeUndefined()
})
