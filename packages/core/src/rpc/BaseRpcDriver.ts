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

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'Core-extendWorker': {
      args: WorkerHandle
      result: WorkerHandle
    }
  }
}

export interface RpcDriverConstructorArgs {
  config: AnyConfigurationModel
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

  destroy() {
    // terminate the underlying worker once it resolves; a worker that never
    // booted (rejected promise) has nothing to terminate, so swallow that
    this.workerP
      ?.then(worker => {
        worker.destroy()
      })
      .catch(() => {})
    this.workerP = undefined
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

  freeSession(sessionId: string) {
    this.workerAssignments.delete(sessionId)
  }

  // terminate every pooled worker and reset assignment bookkeeping; call when
  // discarding the driver so its worker threads don't outlive it
  destroy() {
    for (const worker of this.workerPool ?? []) {
      worker.destroy()
    }
    this.workerPool = undefined
    this.workerAssignments.clear()
    this.lastWorkerAssignment = -1
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
    )
    const rpcMethod = pluginManager.getRpcMethodType(functionName)

    // statusCallback is an out-of-band progress handle, not data: the worker
    // wires up its own via a message channel (see rpcWorker wrapForRpc), so keep
    // it out of the serialized payload entirely. Everything that remains must be
    // structured-cloneable; postMessage clones it and throws on anything that
    // isn't, surfacing bad data at the boundary instead of silently dropping it.
    const { statusCallback, ...rest } = args
    const serializedArgs = await rpcMethod.serializeArguments(rest, this.name)

    // now actually call the worker
    const call = await worker.call(functionName, serializedArgs, {
      statusCallback,
      rpcDriverClassName: this.name,
      ...options,
    })

    return rpcMethod.deserializeReturn(call, args, this.name)
  }
}
