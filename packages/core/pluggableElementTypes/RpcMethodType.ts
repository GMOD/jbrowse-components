import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'
import RpcManager from '../rpc/RpcManager'

import {
  deserializeAbortSignal,
  isRemoteAbortSignal,
  RemoteAbortSignal,
} from '../rpc/remoteAbortSignals'

export default class RpcMethodType extends PluggableElementBase {
  serializeArguments(args: {}): {} {
    return args
  }

  deserializeArguments<
    SERIALIZED extends { signal?: RemoteAbortSignal | undefined }
  >(serializedArgs: SERIALIZED) {
    const { signal } = serializedArgs
    if (signal && isRemoteAbortSignal(signal)) {
      return { ...serializedArgs, signal: deserializeAbortSignal(signal) }
    }
    return { ...serializedArgs, signal: undefined }
  }

  async execute(
    pluginManager: PluginManager,
    serializedArgs: unknown,
  ): Promise<unknown> {
    throw new Error('execute method is abstract')
  }

  serializeReturn(originalReturn: unknown) {
    return originalReturn
  }

  deserializeReturn(serializedReturn: unknown): unknown {
    return serializedReturn
  }

  async call(
    rpcManager: RpcManager,
    stateGroupName: string,
    args: {},
    opts: {},
  ) {
    const serialized: {} = this.serializeArguments(args)
    const serializedReturn = await rpcManager.call(
      stateGroupName,
      this.name,
      serialized,
      opts,
    )
    return this.deserializeReturn(serializedReturn)
  }
}
