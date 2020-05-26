import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'

import {
  deserializeAbortSignal,
  isRemoteAbortSignal,
  RemoteAbortSignal,
} from '../rpc/remoteAbortSignals'

export type RpcMethodConstructor = new (pm: PluginManager) => RpcMethodType

export default class RpcMethodType extends PluggableElementBase {
  pluginManager: PluginManager

  name = 'UNKNOWN'

  constructor(pluginManager: PluginManager) {
    super({ name: '' })
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
}
