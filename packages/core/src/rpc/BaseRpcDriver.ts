import { isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { readConfObject } from '../configuration/index.ts'
import { clamp } from '../util/index.ts'
import { diagnoseSerializationError } from '../util/serializationCheck.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'

export interface WorkerHandle {
  status?: string
  error?: unknown
  on?: (channel: string, callback: (message: unknown) => void) => void
  off?: (channel: string, callback: (message: unknown) => void) => void
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

function detectHardwareConcurrency() {
  const mainThread = typeof window !== 'undefined'
  const canDetect = mainThread && 'hardwareConcurrency' in window.navigator
  return mainThread && canDetect ? window.navigator.hardwareConcurrency : 1
}
class LazyWorker {
  workerP?: Promise<WorkerHandle> | undefined

  constructor(public driver: BaseRpcDriver) {}

  async getWorker() {
    if (!this.workerP) {
      this.workerP = this.driver.makeWorker().catch((e: unknown) => {
        this.workerP = undefined
        throw e
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
  filterArgs<THING_TYPE>(thing: THING_TYPE, sessionId: string): THING_TYPE {
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
        .filter(thing => isCloneable(thing))
        .map(t => this.filterArgs(t, sessionId)) as unknown as THING_TYPE
    } else if (isStateTreeNode(thing) && !isAlive(thing)) {
      throw new Error('dead state tree node passed to RPC call')
    } else if (thing instanceof File) {
      return thing
    } else {
      return Object.fromEntries(
        Object.entries(thing)
          .filter(e => isCloneable(e[1]))
          .map(([k, v]) => [k, this.filterArgs(v, sessionId)]),
      ) as THING_TYPE
    }
  }

  async remoteAbort(
    sessionId: string,
    functionName: string,
    stopTokenId: number,
  ) {
    const worker = await this.getWorker(sessionId)
    await worker.call(
      functionName,
      { stopTokenId },
      { rpcDriverClassName: this.name },
    )
  }

  createWorkerPool(): LazyWorker[] {
    const hardwareConcurrency = detectHardwareConcurrency()

    const workerCount =
      readConfObject(this.config, 'workerCount') ||
      clamp(1, Math.max(1, hardwareConcurrency - 1), 5)

    const workers = []
    for (let i = 0; i < workerCount; i++) {
      workers.push(new LazyWorker(this))
    }
    return workers
  }

  getWorkerPool() {
    if (!this.workerPool) {
      const res = this.createWorkerPool()
      this.workerPool = res
      return res // making this several steps makes TS happy
    }
    return this.workerPool
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

    // // eslint-disable-next-line no-console
    // console.log(`[RPC] ${this.name}: ${functionName} (worker)`)

    const unextendedWorker = await this.getWorker(sessionId)
    const worker = pluginManager.evaluateExtensionPoint(
      'Core-extendWorker',
      unextendedWorker,
    ) as WorkerHandle
    const rpcMethod = pluginManager.getRpcMethodType(functionName)
    if (!rpcMethod) {
      throw new Error(`unknown RPC method ${functionName}`)
    }
    const serializedArgs = await rpcMethod.serializeArguments(args, this.name)
    const filteredAndSerializedArgs = this.filterArgs(serializedArgs, sessionId)

    // now actually call the worker
    let call
    try {
      call = await worker.call(functionName, filteredAndSerializedArgs, {
        statusCallback: args.statusCallback,
        rpcDriverClassName: this.name,
        ...options,
      })
    } catch (e) {
      throw diagnoseSerializationError(
        e,
        filteredAndSerializedArgs,
        `RPC call ${functionName}`,
      )
    }

    return rpcMethod.deserializeReturn(call, args, this.name)
  }
}
