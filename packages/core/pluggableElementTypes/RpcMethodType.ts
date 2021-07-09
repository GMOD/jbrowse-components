import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'
import {
  setBlobMap,
  getBlobMap,
  setInternetAccountMap,
  getTokensFromStorage,
  searchInArgs,
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
    const internetAccountMap = getTokensFromStorage()

    const id = searchInArgs(args, 'internetAccountId')

    // googleOAuth

    // if (args.adapterConfig) {
    // recursively check all keys for internetAccountId
    // if no internetaccount do nothing,
    // check if that internetAccountId exists in the map, if it doesnt do below
    // return this as a promise that doesnt resolve until the token is fetch
    // account's openLocation idealy would be called from here
    // can use this.pluginManager.rootModel.internetAccount to call the correct open location
    // }

    // return new Promise(async r => {
    //   const fileUrl = await account.openLocation()
    //    call getTokensFromStorage()
    //   add fileUrl to adapterConfig correctly
    //   resolve({
    //   ..args, blobMap, internetAccountMap
    //    })
    // })
    // check args for internetAccountIds, then getTokenMap, make sure that internetACcountId has a token
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
