import { isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { readConfObject } from '../configuration/index.ts'
import { clamp } from '../util/index.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'

export interface WorkerHandle {
  destroy(): void
  call(
    functionName: string,
    args?: unknown,
    options?: {
      statusCallback?(message: string): void
      rpcDriverClassName: string
    },
  ): Promise<unknown>
}

export interface RpcDriverConstructorArgs {
  config: AnyConfigurationModel
}

function isCloneable(thing: unknown) {
  return !(typeof thing === 'function') && !(thing instanceof Error)
}

// values that structured-clone handles natively; filterArgs must pass these
// through unchanged, since Object.entries on them yields [] and would collapse
// them to plain {}
function isStructuredClonePassthrough(thing: object): boolean {
  return (
    thing instanceof File ||
    thing instanceof Blob ||
    thing instanceof ArrayBuffer ||
    ArrayBuffer.isView(thing) ||
    thing instanceof Date ||
    thing instanceof Map ||
    thing instanceof Set ||
    thing instanceof RegExp
  )
}

function detectHardwareConcurrency() {
  const canDetect =
    typeof window !== 'undefined' && 'hardwareConcurrency' in window.navigator
  return canDetect ? window.navigator.hardwareConcurrency : 1
}
class LazyWorker {
  workerP?: Promise<WorkerHandle>

  constructor(public driver: BaseRpcDriver) {}

  async getWorker() {
    if (!this.workerP) {
      // wrap so a rejection clears workerP, letting the next caller retry
      const p = this.driver.makeWorker()
      this.workerP = p
      p.catch(() => {
        if (this.workerP === p) {
          this.workerP = undefined
        }
      })
    }
    return this.workerP
  }
}

export default abstract class BaseRpcDriver {
  abstract name: string

  private lastWorkerAssignment = -1

  // sessionId -> worker number
  private workerAssignments = new Map<string, number>()

  abstract makeWorker(): Promise<WorkerHandle>

  private workerPool?: LazyWorker[]

  config: AnyConfigurationModel

  constructor(args: RpcDriverConstructorArgs) {
    this.config = args.config
  }

  // filter the given object and just remove any non-cloneable things from it
  filterArgs<THING_TYPE>(thing: THING_TYPE): THING_TYPE {
    // Fast path for primitives (most common case)
    if (thing === null || thing === undefined) {
      return thing
    }
    const type = typeof thing
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return thing
    }
    if (type !== 'object') {
      // functions and other non-cloneables
      return undefined as unknown as THING_TYPE
    }

    // Object cases
    if (Array.isArray(thing)) {
      return thing
        .filter(t => isCloneable(t))
        .map(t => this.filterArgs(t)) as unknown as THING_TYPE
    } else if (isStateTreeNode(thing) && !isAlive(thing)) {
      throw new Error('dead state tree node passed to RPC call')
    } else if (isStructuredClonePassthrough(thing)) {
      return thing
    } else {
      return Object.fromEntries(
        Object.entries(thing)
          .filter(e => isCloneable(e[1]))
          .map(([k, v]) => [k, this.filterArgs(v)]),
      ) as THING_TYPE
    }
  }

  freeSession(sessionId: string) {
    this.workerAssignments.delete(sessionId)
  }

  createWorkerPool(): LazyWorker[] {
    const hardwareConcurrency = detectHardwareConcurrency()

    const workerCount =
      readConfObject(this.config, 'workerCount') ||
      clamp(hardwareConcurrency - 1, 1, 5)

    const workers = []
    for (let i = 0; i < workerCount; i++) {
      workers.push(new LazyWorker(this))
    }
    return workers
  }

  getWorkerPool() {
    return (this.workerPool ??= this.createWorkerPool())
  }

  async getWorker(sessionId: string): Promise<WorkerHandle> {
    const workers = this.getWorkerPool()
    let workerNumber = this.workerAssignments.get(sessionId)
    if (workerNumber === undefined) {
      const workerAssignment = (this.lastWorkerAssignment + 1) % workers.length
      this.workerAssignments.set(sessionId, workerAssignment)
      this.lastWorkerAssignment = workerAssignment
      workerNumber = workerAssignment
    }

    return workers[workerNumber]!.getWorker()
  }

  async call(
    pluginManager: PluginManager,
    sessionId: string,
    functionName: string,
    args: {
      statusCallback?: (message: unknown) => void
    },
    options = {},
  ) {
    if (!sessionId) {
      throw new TypeError('sessionId is required')
    }

    const unextendedWorker = await this.getWorker(sessionId)
    const worker = pluginManager.evaluateExtensionPoint(
      'Core-extendWorker',
      unextendedWorker,
    ) as WorkerHandle
    const rpcMethod = pluginManager.getRpcMethodType(functionName)
    const serializedArgs = await rpcMethod.serializeArguments(args, this.name)
    const filteredAndSerializedArgs = this.filterArgs(serializedArgs)

    // now actually call the worker
    const call = await worker.call(functionName, filteredAndSerializedArgs, {
      statusCallback: args.statusCallback,
      rpcDriverClassName: this.name,
      ...options,
    })

    return rpcMethod.deserializeReturn(call, args, this.name)
  }
}
