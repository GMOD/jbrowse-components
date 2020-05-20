import { getSnapshot, isStateTreeNode } from 'mobx-state-tree'
import { iterMap, objectFromEntries } from '../util'
import BaseRpcDriver from './BaseRpcDriver'
import PluginManager from '../PluginManager'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isPlainObject(thing: any): boolean {
  // prototype is object, contains no functions
  if (typeof thing !== 'object') return false
  if (Object.getPrototypeOf(Object.getPrototypeOf(thing)) !== null) return false
  return true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cloneArgs(args: any): any {
  if (Array.isArray(args)) {
    return args.map(cloneArgs)
  }

  if (typeof args === 'object') {
    if (isStateTreeNode(args)) {
      return getSnapshot(args)
    }
    if (args instanceof Map) {
      return new Map(
        iterMap(args.entries(), ([k, v]) => [k, cloneArgs(v)], args.size),
      )
    }
    if (args instanceof Set) {
      return new Set(
        iterMap(args.entries(), ([, v]) => cloneArgs(v), args.size),
      )
    }
    if (args instanceof AbortSignal) {
      // pass AbortSignals unmodified
      return args
    }
    if (typeof args.toJSON === 'function') {
      return args.toJSON()
    }
    if (isPlainObject(args)) {
      return objectFromEntries(
        Object.entries(args).map(([k, v]) => [k, cloneArgs(v)]),
      )
    }

    throw new TypeError(`cannot clone args, unsupported object type ${args}`)
  }

  if (typeof args === 'function') {
    return undefined
  }

  return args
}

class DummyHandle {
  destroy(): void {}

  async call(
    functionName: string,
    filteredArgs?: {},
    options = {},
  ): Promise<unknown> {
    return undefined
  }
}

/**
 * Stub RPC driver class that runs RPC functions in-band in the main thread.
 *
 * @param rpcFuncs - object containing runnable rpc functions
 */
export default class MainThreadRpcDriver extends BaseRpcDriver {
  makeWorker: () => DummyHandle

  constructor(args: {}) {
    super()
    this.makeWorker = (): DummyHandle => new DummyHandle()
  }

  async call(
    pluginManager: PluginManager,
    stateGroupName: string,
    functionName: string,
    args: {},
    options = {},
  ): Promise<unknown> {
    if (!stateGroupName) {
      throw new TypeError('stateGroupName is required')
    }
    const rpcMethod = pluginManager.getRpcMethodType(functionName)
    const serializedArgs = await rpcMethod.serializeArguments(args)
    const filteredAndSerializedArgs = this.filterArgs(
      serializedArgs,
      pluginManager,
      stateGroupName,
    )
    const result = await rpcMethod.execute(filteredAndSerializedArgs)
    return rpcMethod.deserializeReturn(result)
  }
}
