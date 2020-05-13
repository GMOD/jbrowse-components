import { getSnapshot, isStateTreeNode } from 'mobx-state-tree'
import { iterMap, objectFromEntries } from '../util'
import BaseRpcDriver from './BaseRpcDriver'

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call(functionName: string, filteredArgs?: any, options = {}): any {}
}

/**
 * Stub RPC driver class that runs RPC functions in-band in the main thread.
 *
 * @param rpcFuncs - object containing runnable rpc functions
 */
export default class MainThreadRpcDriver extends BaseRpcDriver {
  makeWorker: () => DummyHandle

  rpcFuncs: Record<string, Function>

  constructor({ rpcFuncs }: { rpcFuncs: Record<string, Function> }) {
    super()
    if (!rpcFuncs) throw new TypeError('rpcFuncs argument required')
    this.rpcFuncs = rpcFuncs
    this.makeWorker = (): DummyHandle => new DummyHandle()
  }

  call(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pluginManager: any,
    stateGroupName: string,
    functionName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any,
    options = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    const func = this.rpcFuncs[functionName]
    if (!func) {
      // debugger
      throw new Error(
        `MainThreadRpcDriver has no RPC function "${functionName}"`,
      )
    }

    const clonedArgs = cloneArgs(args)
    return func.call(this, pluginManager, clonedArgs)
  }
}
