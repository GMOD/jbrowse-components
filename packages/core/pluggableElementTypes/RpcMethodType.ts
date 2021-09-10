/* eslint-disable @typescript-eslint/no-explicit-any */
import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'
import { setBlobMap, getBlobMap } from '../util/tracks'
import {
  UriLocation,
  AbstractRootModel,
  isAppRootModel,
  isUriLocation,
} from '../util/types'

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

    const modifiedArgs: any = await this.augmentLocationObjects(args)
    return { ...modifiedArgs, blobMap }
  }

  async serializeNewAuthArguments(location: UriLocation) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootModel: AbstractRootModel | undefined = this.pluginManager
      .rootModel

    if (!isAppRootModel(rootModel)) {
      throw new Error('This app does not support authentication')
    }

    if (location.internetAccountPreAuthorization) {
      throw new Error('Failed to get clean internet account authorization info')
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

      return locationWithPreAuth
    }
    return location
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

  // TODOAUTH unit test this method
  private async augmentLocationObjects(thing: any): Promise<any> {
    if (isUriLocation(thing)) {
      return this.serializeNewAuthArguments(thing)
    }
    if (Array.isArray(thing)) {
      return Promise.all(thing.map((p: any) => this.augmentLocationObjects(p)))
    }
    if (typeof thing === 'object' && thing !== null) {
      const newThing: any = {}
      for (const [key, value] of Object.entries(thing)) {
        if (Array.isArray(value)) {
          newThing[key] = await Promise.all(
            value.map((p: any) => this.augmentLocationObjects(p)),
          )
        } else if (typeof value === 'object' && value !== null) {
          newThing[key] = await this.augmentLocationObjects(value)
        } else {
          newThing[key] = value
        }
      }
      return newThing
    }
    return thing
  }
}
