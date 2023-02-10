import { isAlive, isStateTreeNode } from 'mobx-state-tree'
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

function getGlobalObject(): Window {
  // Based on window-or-global
  // https://github.com/purposeindustries/window-or-global/blob/322abc71de0010c9e5d9d0729df40959e1ef8775/lib/index.js
  return (
    // eslint-disable-next-line no-restricted-globals
    (typeof self === 'object' && self.self === self && self) ||
    (typeof global === 'object' && global.global === global && global) ||
    // @ts-ignore
    this
  )
}
function isInWebWorker(globalObject: ReturnType<typeof getGlobalObject>) {
  return Boolean('WorkerGlobalScope' in globalObject)
}

function deepSearch(obj: Record<string, unknown>) {
  const queue = [obj]
  const uris = [] as UriLocation[]

  while (queue.length) {
    const o = queue.shift()
    if (!o) {
      break
    }
    Object.values(o).forEach(v => {
      if (isUriLocation(v)) {
        uris.push(v)
      } else if (v !== null && typeof v === 'object') {
        queue.push(v as Record<string, unknown>)
      }
    })
  }
  return uris
}

export type RpcMethodConstructor = new (pm: PluginManager) => RpcMethodType

export default abstract class RpcMethodType extends PluggableElementBase {
  constructor(public pluginManager: PluginManager) {
    super({})
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

    const account = rootModel.findAppropriateInternetAccount(loc)

    if (account) {
      loc.internetAccountPreAuthorization =
        await account.getPreAuthorizationInformation(loc)
    }
    return loc
  }

  async deserializeArguments<
    T extends {
      signal?: RemoteAbortSignal
      blobMap?: Record<string, File>
    },
  >(serializedArgs: T, _rpcDriverClassName: string) {
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
    _rpcDriver: string,
  ) {
    let r
    try {
      r = await serializedReturn
    } catch (error) {
      if (isAuthNeededException(error)) {
        const retryAccount =
          // @ts-ignore
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async augmentLocationObjects(thing: any, i = 0): Promise<any> {
    console.log({ thing })
    const uris = deepSearch(thing)
    console.log({ uris })
    await Promise.all(uris.map(uri => this.serializeNewAuthArguments(uri)))
    return thing
  }
}
