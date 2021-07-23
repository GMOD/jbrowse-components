import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'
import {
  setBlobMap,
  getBlobMap,
  setAuthenticationInfoMap,
} from '../util/tracks'
import { searchOrReplaceInArgs } from '../util'

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
    const authenticationInfoMap = {}

    if (
      args.hasOwnProperty('adapterConfig') &&
      searchOrReplaceInArgs(args, 'internetAccountId')
    ) {
      return this.serializeAuthArguments(args, blobMap, authenticationInfoMap)
    }
    return { ...args, blobMap, authenticationInfoMap }
  }

  async serializeAuthArguments(
    args: {},
    blobMap: { [key: string]: File },
    authenticationInfoMap: Record<string, string>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootModel: any = this.pluginManager.rootModel
    this.pluginManager.rootModel.internetAccounts.find(account => {
      return account.internetAccountId === 'specificId'
    })
    authenticationInfoMap = rootModel?.getAuthenticationInfoMap()
    const adapterConfig = searchOrReplaceInArgs(args, 'adapterConfig')

    const fileLocation =
      adapterConfig[
        Object.keys(adapterConfig).find(key => {
          return key.toLowerCase().includes('location')
        }) as string
      ]

    const modifiedArgs = await rootModel?.findAppropriateInternetAccount(
      fileLocation,
      authenticationInfoMap,
      args,
    )
    if (modifiedArgs) {
      authenticationInfoMap = rootModel?.getAuthenticationInfoMap()
      return { ...modifiedArgs, blobMap, authenticationInfoMap }
    }
  }

  async deserializeArguments<
    SERIALIZED extends {
      signal?: RemoteAbortSignal
      blobMap?: Record<string, File>
      authenticationInfoMap?: Record<string, string>
    }
  >(serializedArgs: SERIALIZED, _rpcDriverClassName: string) {
    if (serializedArgs.blobMap) {
      setBlobMap(serializedArgs.blobMap)
    }
    if (serializedArgs.authenticationInfoMap) {
      setAuthenticationInfoMap(serializedArgs.authenticationInfoMap)
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
