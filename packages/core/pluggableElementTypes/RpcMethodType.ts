import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'
import {
  setBlobMap,
  getBlobMap,
  setInternetAccountMap,
  getTokensFromStorage,
  searchOrReplaceInArgs,
} from '../util/tracks'

import {
  deserializeAbortSignal,
  isRemoteAbortSignal,
  RemoteAbortSignal,
} from '../rpc/remoteAbortSignals'

export type RpcMethodConstructor = new (pm: PluginManager) => RpcMethodType

export default abstract class RpcMethodType extends PluggableElementBase {
  pluginManager: PluginManager

  name = 'UNKNOWN'

  constructor(pluginManager: PluginManager) {
    super({ name: '' })
    this.pluginManager = pluginManager
  }

  async serializeArguments(args: {}, _rpcDriverClassName: string): Promise<{}> {
    const blobMap = getBlobMap()
    let internetAccountMap = getTokensFromStorage()

    if (args.hasOwnProperty('adapterConfig')) {
      // @ts-ignore
      const editedArgs = await this.pluginManager.rootModel?.findAppropriateInternetAccount(
        // @ts-ignore
        new URL(searchOrReplaceInArgs(args.adapterConfig, 'uri')),
        internetAccountMap,
        args,
      )
      if (editedArgs) {
        internetAccountMap = getTokensFromStorage()
        return { ...editedArgs, blobMap, internetAccountMap }
      }
    }
    return { ...args, blobMap, internetAccountMap }
  }

  async deserializeArguments<
    SERIALIZED extends {
      signal?: RemoteAbortSignal
      blobMap?: Record<string, File>
      internetAccountMap?: Record<string, string>
    }
  >(serializedArgs: SERIALIZED, _rpcDriverClassName: string) {
    if (serializedArgs.blobMap) {
      setBlobMap(serializedArgs.blobMap)
    }
    if (serializedArgs.internetAccountMap) {
      setInternetAccountMap(serializedArgs.internetAccountMap)
    }
    const { signal } = serializedArgs
    if (signal && isRemoteAbortSignal(signal)) {
      return { ...serializedArgs, signal: deserializeAbortSignal(signal) }
    }

    return { ...serializedArgs, signal: undefined }
  }

  abstract async execute(
    serializedArgs: unknown,
    rpcDriverClassName: string,
  ): Promise<unknown>

  async serializeReturn(
    originalReturn: unknown,
    _args: unknown,
    _rpcDriverClassName: string,
  ) {
    return originalReturn
  }

  async deserializeReturn(
    serializedReturn: unknown,
    _args: unknown,
    _rpcDriverClassName: string,
  ): Promise<unknown> {
    return serializedReturn
  }
}
