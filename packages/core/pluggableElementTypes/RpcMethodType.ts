import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'
import { setBlobMap, getBlobMap } from '../util/tracks'
import { getSnapshot, isAlive, isStateTreeNode } from 'mobx-state-tree'
import {
  isAppRootModel,
  isUriLocation,
  isAuthNeededException,
  AuthNeededError,
  RetryError,
  UriLocation,
} from '../util/types'

import {
  deserializeAbortSignal,
  isRemoteAbortSignal,
  RemoteAbortSignal,
} from '../rpc/remoteAbortSignals'

export type RpcMethodConstructor = new (pm: PluginManager) => RpcMethodType

export default abstract class RpcMethodType extends PluggableElementBase {
  name = 'UNKNOWN'

  constructor(public pluginManager: PluginManager) {
    super({ name: '' })
  }

  async serializeArguments(args: {}, _rpcDriverClassName: string): Promise<{}> {
    const blobMap = getBlobMap()
    args = await this.augmentLocationObjects(args)
    return { ...args, blobMap }
  }

  async serializeNewAuthArguments(loc: UriLocation) {
    const rootModel = this.pluginManager.rootModel

    // args dont need auth or already have auth
    if (!isAppRootModel(rootModel) || loc.internetAccountPreAuthorization) {
      return loc
    }

    const account = rootModel?.findAppropriateInternetAccount(loc)

    if (account) {
      loc.internetAccountPreAuthorization =
        await account.getPreAuthorizationInformation(loc)
    }
    return loc
  }

  async deserializeArguments<
    SERIALIZED extends {
      signal?: RemoteAbortSignal
      blobMap?: Record<string, File>
    },
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

  //@eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async augmentLocationObjects<T>(thing: T): any {
    if (isStateTreeNode(thing) && isAlive(thing)) {
      const type = thing.type
      thing = JSON.parse(JSON.stringify(getSnapshot(thing)))
      thing.type = type
    }
    if (isUriLocation(thing)) {
      return this.serializeNewAuthArguments(thing)
    } else if (Array.isArray(thing)) {
      return Promise.all(thing.map(val => this.augmentLocationObjects(val)))
    } else if (typeof thing === 'object' && thing !== null) {
      return Object.fromEntries(
        await Promise.all(
          Object.entries(thing).map(async ([key, val]) => {
            console.log(key, val)
            return [key, await this.augmentLocationObjects(val)]
          }),
        ),
      )
    } else {
      return thing
    }
  }
}
