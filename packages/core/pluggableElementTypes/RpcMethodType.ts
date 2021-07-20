import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'
import { setBlobMap, getBlobMap, setAdditionalInfoMap } from '../util/tracks'
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
    const additionalInfoMap = {}

    if (
      args.hasOwnProperty('adapterConfig') &&
      searchOrReplaceInArgs(args, 'internetAccountId')
    ) {
      return this.serializeAuthArguments(args, blobMap, additionalInfoMap)
    }
    return { ...args, blobMap, additionalInfoMap }
  }

  async serializeAuthArguments(
    args: {},
    blobMap: { [key: string]: File },
    additionalInfoMap: Record<string, string>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootModel: any = this.pluginManager.rootModel
    additionalInfoMap = rootModel?.getTokensFromStorage()

    const modifiedArgs = await rootModel?.findAppropriateInternetAccount(
      // @ts-ignore
      new URL(searchOrReplaceInArgs(args.adapterConfig, 'uri')),
      additionalInfoMap,
      args,
    )
    if (modifiedArgs) {
      additionalInfoMap = rootModel?.getTokensFromStorage()
      return { ...modifiedArgs, blobMap, additionalInfoMap }
    }
  }

  async deserializeArguments<
    SERIALIZED extends {
      signal?: RemoteAbortSignal
      blobMap?: Record<string, File>
      additionalInfoMap?: Record<string, string>
    }
  >(serializedArgs: SERIALIZED, _rpcDriverClassName: string) {
    if (serializedArgs.blobMap) {
      setBlobMap(serializedArgs.blobMap)
    }
    if (serializedArgs.additionalInfoMap) {
      setAdditionalInfoMap(serializedArgs.additionalInfoMap)
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
