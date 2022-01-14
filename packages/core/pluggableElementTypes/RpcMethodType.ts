import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'
import { setBlobMap, getBlobMap } from '../util/tracks'
import { isAlive, isStateTreeNode } from 'mobx-state-tree'
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

export type RpcMethodConstructor = new (pm: PluginManager) => RpcMethodType

export default abstract class RpcMethodType extends PluggableElementBase {
  name = 'UNKNOWN'

  constructor(public pluginManager: PluginManager) {
    super({ name: '' })
  }

  async serializeArguments(args: {}, _rpcDriverClassName: string): Promise<{}> {
    const blobMap = getBlobMap()
    await this.augmentLocationObjects(args)
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
      const auth = await account.getPreAuthorizationInformation(loc)
      if (isStateTreeNode(loc) && isAlive(loc)) {
        loc.internetAccountPreAuthorization = auth
      }
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
    const { rootModel } = this.pluginManager
    try {
      r = await serializedReturn
    } catch (error) {
      if (isAuthNeededException(error)) {
        //@ts-ignore
        const retryAccount = rootModel?.createEphemeralInternetAccount(
          `HTTPBasicInternetAccount-${new URL(error.location.uri).origin}`,
          {},
          error.location,
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
  private async augmentLocationObjects(thing: any): Promise<any> {
    if (isStateTreeNode(thing) && !isAlive(thing)) {
      return thing
    }

    if (isUriLocation(thing)) {
      this.serializeNewAuthArguments(thing)
    } else if (Array.isArray(thing)) {
      await Promise.all(thing.map(val => this.augmentLocationObjects(val)))
    } else if (
      typeof thing === 'object' &&
      thing !== null &&
      !(thing instanceof AbortSignal)
    ) {
      await Promise.all(
        Object.entries(thing).map(async ([key, val]) => {
          return [key, await this.augmentLocationObjects(val)]
        }),
      )
    }
  }
}
