import { isStateTreeNode, getSnapshot } from 'mobx-state-tree'

import { iterMap, objectFromEntries } from '../util'

export default class MainThreadRpcDriver {
  /**
   * Stub RPC driver class that runs RPC functions in-band in the main thread.
   *
   * @param {Object} rpcFuncs object containing runnable rpc functions
   */
  constructor({ rpcFuncs }) {
    this.rpcFuncs = rpcFuncs
    if (!rpcFuncs) throw new TypeError('rpcFuncs argument required')
  }

  isPlainObject(thing) {
    // prototype is object, contains no functions
    if (typeof thing !== 'object') return false
    if (Object.getPrototypeOf(Object.getPrototypeOf(thing)) !== null)
      return false
    return true
  }

  cloneArgs(args) {
    if (Array.isArray(args)) {
      return args.map(this.cloneArgs.bind(this))
    }

    if (typeof args === 'object') {
      if (isStateTreeNode(args)) {
        return getSnapshot(args)
      }
      if (args instanceof Map) {
        return new Map(
          iterMap(
            args.entries(),
            ([k, v]) => [k, this.cloneArgs(v)],
            args.size,
          ),
        )
      }
      if (args instanceof Set) {
        return new Set(
          iterMap(args.entries(), ([, v]) => this.cloneArgs(v), args.size),
        )
      }
      if (args instanceof AbortSignal) {
        // pass AbortSignals unmodified
        return args
      }
      if (typeof args.toJSON === 'function') {
        return args.toJSON()
      }
      if (this.isPlainObject(args)) {
        return objectFromEntries(
          Object.entries(args).map(([k, v]) => [k, this.cloneArgs(v)]),
        )
      }

      throw new TypeError(`cannot clone args, unsupported object type ${args}`)
    }

    if (typeof args === 'function') {
      return undefined
    }

    return args
  }

  call(pluginManager, stateGroupName, functionName, args) {
    const func = this.rpcFuncs[functionName]
    if (!func) {
      // debugger
      throw new Error(
        `MainThreadRpcDriver has no RPC function "${functionName}"`,
      )
    }

    const clonedArgs = this.cloneArgs(args)
    return func.call(this, pluginManager, clonedArgs)
  }
}
