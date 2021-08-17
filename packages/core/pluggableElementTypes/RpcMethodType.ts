import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'
import { setBlobMap, getBlobMap } from '../util/tracks'
import { searchForLocationObjects, replaceInArgs } from '../util'
import { UriLocation } from '../util/types'
import cloneDeep from 'clone-deep'

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

    const modifiedArgs = cloneDeep(args)
    const locationObjects = searchForLocationObjects(modifiedArgs)

    for (const i in locationObjects) {
      if (locationObjects[i].hasOwnProperty('internetAccountId')) {
        await this.serializeNewAuthArguments(modifiedArgs, locationObjects[i])
      }
    }

    return { ...modifiedArgs, blobMap }
  }

  async serializeNewAuthArguments(args: {}, location: UriLocation) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootModel: any = this.pluginManager.rootModel

    if (location.internetAccountPreAuthorization) {
      throw new Error('PreAuthorization should not exist yet')
    }
    const account = rootModel?.findAppropriateInternetAccount(location)

    if (account) {
      const modifiedPreAuth = await account.getPreAuthorizationInformation(
        location,
      )

      const locationWithPreAuth = {
        ...location,
        internetAccountPreAuthorization: modifiedPreAuth,
      }

      replaceInArgs(args, location, locationWithPreAuth)
    }
  }

  async deserializeArguments<
    SERIALIZED extends {
      signal?: RemoteAbortSignal
      blobMap?: Record<string, File>
    }
  >(serializedArgs: SERIALIZED, _rpcDriverClassName: string) {
    if (serializedArgs.blobMap) {
      setBlobMap(serializedArgs.blobMap)
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
