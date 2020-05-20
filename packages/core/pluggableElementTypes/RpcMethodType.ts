import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'
import RpcManager from '../rpc/RpcManager'

import {
  deserializeAbortSignal,
  isRemoteAbortSignal,
  RemoteAbortSignal,
} from '../rpc/remoteAbortSignals'

export default class RpcMethodType extends PluggableElementBase {
  pluginManager: PluginManager

  constructor(pluginManager: PluginManager) {
    super()
    this.pluginManager = pluginManager
  }

  async serializeArguments(args: {}): Promise<{}> {
    return args
  }

  async deserializeArguments<SERIALIZED extends { signal?: RemoteAbortSignal }>(
    serializedArgs: SERIALIZED,
  ) {
    const { signal } = serializedArgs
    if (signal && isRemoteAbortSignal(signal)) {
      return { ...serializedArgs, signal: deserializeAbortSignal(signal) }
    }
    return { ...serializedArgs, signal: undefined }
  }

  async execute(serializedArgs: unknown): Promise<unknown> {
    throw new Error('execute method is abstract')
  }

  async serializeReturn(originalReturn: unknown) {
    return originalReturn
  }

  async deserializeReturn(serializedReturn: unknown): Promise<unknown> {
    return serializedReturn
  }

  async call(
    rpcManager: RpcManager,
    stateGroupName: string,
    args: {},
    opts: {},
  ) {
    const serialized: {} = await this.serializeArguments(args)
    const serializedReturn = await rpcManager.call(
      stateGroupName,
      this.name,
      serialized,
      opts,
    )
    return this.deserializeReturn(serializedReturn)
  }
}
