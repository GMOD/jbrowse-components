import PluggableElementBase from './PluggableElementBase'
import mapObject from '../util/map-obj'
import { setBlobMap, getBlobMap } from '../util/tracks'
import {
  isAppRootModel,
  isUriLocation,
  isAuthNeededException,
  RetryError,
} from '../util/types'
import type PluginManager from '../PluginManager'
import type { UriLocation } from '../util/types'

export type RpcMethodConstructor = new (pm: PluginManager) => RpcMethodType

export default abstract class RpcMethodType extends PluggableElementBase {
  constructor(public pluginManager: PluginManager) {
    super({})
  }

  async serializeArguments(
    args: Record<string, unknown>,
    rpcDriverClassName: string,
  ): Promise<Record<string, unknown>> {
    const blobMap = getBlobMap()
    await this.augmentLocationObjects(args, rpcDriverClassName)
    return { ...args, blobMap }
  }

  async serializeNewAuthArguments(
    loc: UriLocation,
    rpcDriverClassName: string,
  ) {
    const rootModel = this.pluginManager.rootModel

    // args dont need auth or already have auth
    if (!isAppRootModel(rootModel) || loc.internetAccountPreAuthorization) {
      return loc
    }

    const account = rootModel.findAppropriateInternetAccount(loc)

    // mutating loc object is not allowed in MainThreadRpcDriver, and is only
    // needed for web worker RPC
    if (account && rpcDriverClassName !== 'MainThreadRpcDriver') {
      loc.internetAccountPreAuthorization =
        await account.getPreAuthorizationInformation(loc)
    }
    return loc
  }

  async deserializeArguments<T>(
    args: T & { blobMap?: Record<string, File> },
    _rpcDriverClassName: string,
  ): Promise<T> {
    if (args.blobMap) {
      setBlobMap(args.blobMap)
    }

    return args
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
  ) {
    let r: unknown
    try {
      r = await serializedReturn
    } catch (error) {
      if (isAuthNeededException(error)) {
        const retryAccount = // @ts-expect-error
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
    rpcDriverClassName: string,
  ) {
    const uris = [] as UriLocation[]

    // using map-obj avoids cycles, seen in circular view svg export
    mapObject(thing, val => {
      if (isUriLocation(val)) {
        uris.push(val)
      }
    })
    for (const uri of uris) {
      await this.serializeNewAuthArguments(uri, rpcDriverClassName)
    }
    return thing
  }
}
