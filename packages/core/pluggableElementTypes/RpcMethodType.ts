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

  async serializeArguments(args: {}, _rpcDriverClassName: string): Promise<{}> {
    return args
  }

  async deserializeArguments<SERIALIZED extends { signal?: RemoteAbortSignal }>(
    serializedArgs: SERIALIZED,
    _rpcDriverClassName: string,
  ) {
    const { signal } = serializedArgs
    if (signal && isRemoteAbortSignal(signal)) {
      return { ...serializedArgs, signal: deserializeAbortSignal(signal) }
    }
    return { ...serializedArgs, signal: undefined }
  }

  async execute(
    _serializedArgs: unknown,
    _rpcDriverClassName: string,
  ): Promise<unknown> {
    throw new Error('execute method is abstract')
  }

  async serializeReturn(originalReturn: unknown, _rpcDriverClassName: string) {
    return originalReturn
  }

  async deserializeReturn(
    serializedReturn: unknown,
    _rpcDriverClassName: string,
  ): Promise<unknown> {
    return serializedReturn
  }
}
