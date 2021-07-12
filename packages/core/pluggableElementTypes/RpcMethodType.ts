import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'
import {
  setBlobMap,
  getBlobMap,
  setInternetAccountMap,
  getTokensFromStorage,
  searchOrReplaceInArgs,
  removeTokenFromStorage,
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
      const adapterConfig = searchOrReplaceInArgs(args, 'adapterConfig')
      const id = searchOrReplaceInArgs(adapterConfig, 'internetAccountId')
      if (id) {
        const token = internetAccountMap[id]
        // @ts-ignore
        const account = this.pluginManager.rootModel?.internetAccounts.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (acc: any) => {
            return acc.internetAccountId === id
          },
        )
        const uri = searchOrReplaceInArgs(adapterConfig, 'uri')

        if (account && uri) {
          if (!token) {
            return new Promise(async resolve => {
              const file = await account.openLocation(new URL(uri))
              if (file.error) {
                removeTokenFromStorage(id, internetAccountMap)
                if (account.accountConfig.hasRefreshToken) {
                  await account.exchangeRefreshForAccessToken()
                  internetAccountMap = getTokensFromStorage()
                }
              }
              const editedArgs = JSON.parse(JSON.stringify(args))
              searchOrReplaceInArgs(editedArgs, 'uri', file)
              internetAccountMap = getTokensFromStorage()
              resolve({ ...editedArgs, blobMap, internetAccountMap })
            })
          } else {
            const file = await account.fetchFile(uri, token)
            // ASK ABOUT THIS: this only works because serialized arguments is called so many times
            // wouldnt work if only called once
            if (file.error) {
              removeTokenFromStorage(id, internetAccountMap)
              if (account.accountConfig.hasRefreshToken) {
                await account.exchangeRefreshForAccessToken()
                internetAccountMap = getTokensFromStorage()
              }
            }
            const editedArgs = JSON.parse(JSON.stringify(args))
            searchOrReplaceInArgs(editedArgs, 'uri', file)
            return { ...editedArgs, blobMap, internetAccountMap }
          }
        }
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
