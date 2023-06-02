import mapObject from '../util/map-obj'
import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'
import { setBlobMap, getBlobMap } from '../util/tracks'
import {
  isAppRootModel,
  isUriLocation,
  isAuthNeededException,
  RetryError,
  UriLocation,
} from '../util/types'

import {
  deserializeAbortSignal,
  isRemoteAbortSignal,
  RemoteAbortSignal,
} from '../rpc/remoteAbortSignals'

interface SerializedArgs {
  signal?: RemoteAbortSignal
  blobMap?: Record<string, File>
}
export type RpcMethodConstructor = new (pm: PluginManager) => RpcMethodType

export default abstract class RpcMethodType extends PluggableElementBase {
  constructor(public pluginManager: PluginManager) {
    super({})
  }

  async serializeArguments(args: {}, rpcDriver: string): Promise<{}> {
    const blobMap = getBlobMap()
    await this.augmentLocationObjects(args, rpcDriver)
    return { ...args, blobMap }
  }

  async serializeNewAuthArguments(loc: UriLocation, rpcDriver: string) {
    const rootModel = this.pluginManager.rootModel

    // args dont need auth or already have auth
    if (!isAppRootModel(rootModel) || loc.internetAccountPreAuthorization) {
      return loc
    }

    const account = rootModel.findAppropriateInternetAccount(loc)
    if (account && rpcDriver !== 'MainThreadRpcDriver') {
      loc.internetAccountPreAuthorization =
        await account.getPreAuthorizationInformation(loc)
    }
    return loc
  }

  async deserializeArguments<T extends SerializedArgs>(
    serializedArgs: T,
    _rpcDriver: string,
  ) {
    if (serializedArgs.blobMap) {
      setBlobMap(serializedArgs.blobMap)
    }
    const { signal } = serializedArgs

    return {
      ...serializedArgs,
      signal: isRemoteAbortSignal(signal)
        ? deserializeAbortSignal(signal)
        : undefined,
    }
  }

  abstract execute(serializedArgs: unknown, rpcDriver: string): Promise<unknown>

  async serializeReturn(
    originalReturn: unknown,
    _args: unknown,
    _rpcDriver: string,
  ) {
    return originalReturn
  }

  async deserializeReturn(
    serializedReturn: unknown,
    _args: unknown,
    _rpcDriver: string,
  ) {
    let r
    try {
      r = await serializedReturn
    } catch (error) {
      if (isAuthNeededException(error)) {
        const retryAccount =
          // @ts-expect-error
          this.pluginManager.rootModel?.createEphemeralInternetAccount(
            `HTTPBasicInternetAccount-${new URL(error.url).origin}`,
            {},
            error.url,
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

  private async augmentLocationObjects(
    thing: Record<string, unknown>,
    rpcDriver: string,
  ) {
    const uris = [] as UriLocation[]

    // using map-obj avoids cycles, seen in circular view svg export
    mapObject(thing, val => {
      if (isUriLocation(val)) {
        uris.push(val)
      }
    })
    for (const uri of uris) {
      await this.serializeNewAuthArguments(uri, rpcDriver)
    }
    return thing
  }
}
