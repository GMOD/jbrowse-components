/* eslint-disable @typescript-eslint/no-explicit-any */
import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'
import { setBlobMap, getBlobMap } from '../util/tracks'
import {
  UriLocation,
  AbstractRootModel,
  isAppRootModel,
  isUriLocation,
  AuthNeededError,
  RetryError,
  isAuthNeededException,
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
    await this.augmentLocationObjects(args)
    return { ...args, blobMap }
  }

  async serializeNewAuthArguments(location: UriLocation) {
    const rootModel: AbstractRootModel | undefined = this.pluginManager
      .rootModel

    // args dont need auth or already have auth
    if (
      !isAppRootModel(rootModel) ||
      location.internetAccountPreAuthorization
    ) {
      return location
    }

    const account = rootModel?.findAppropriateInternetAccount(location)

    if (account) {
      const modifiedPreAuth = await account.getPreAuthorizationInformation(
        location,
      )

      location.internetAccountPreAuthorization = modifiedPreAuth
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

  abstract execute(
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
    let r
    try {
      r = await serializedReturn
    } catch (error) {
      if (isAuthNeededException(error as Error)) {
        const retryAccount =
          // @ts-ignore
          this.pluginManager?.rootModel?.createEphemeralInternetAccount(
            `HTTPBasicInternetAccount-${
              new URL((error as AuthNeededError).location.uri).origin
            }`,
            {},
            (error as AuthNeededError).location,
          )
        throw new RetryError(
          'Retrying with created internet account',
          retryAccount.internetAccountId,
        )
      }
      throw error
    }
    return r
  }

  private async augmentLocationObjects(thing: any): Promise<any> {
    if (isUriLocation(thing)) {
      await this.serializeNewAuthArguments(thing)
    }
    if (Array.isArray(thing)) {
      for (const val of thing) {
        await this.augmentLocationObjects(val)
      }
    }
    if (typeof thing === 'object' && thing !== null) {
      for (const [key, value] of Object.entries(thing)) {
        if (Array.isArray(value)) {
          for (const val of thing[key]) {
            await this.augmentLocationObjects(val)
          }
        } else if (typeof value === 'object' && value !== null) {
          await this.augmentLocationObjects(thing[key])
        }
      }
    }
  }
}
