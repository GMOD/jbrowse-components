import BaseRpcDriver from './BaseRpcDriver.ts'
import { readConfObject } from '../configuration/index.ts'
import { clamp } from '../util/index.ts'

import type PluginManager from '../PluginManager.ts'
import type RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
import type { StatusCallback } from '../util/progress.ts'

export interface WorkerHandle {
  destroy(): void
  call(
    functionName: string,
    args?: unknown,
    options?: {
      // out-of-band progress handle; carries a determinate StatusWithProgress
      // object as readily as a plain string label (see WebWorkerHandle.call)
      statusCallback?: StatusCallback
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

function detectHardwareConcurrency() {
  return typeof navigator === 'undefined' ? 1 : navigator.hardwareConcurrency
}

class LazyWorker {
  workerP?: Promise<WorkerHandle>

  constructor(public driver: WorkerPoolRpcDriver) {}

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

/**
 * Base for drivers that run RPC methods in a pool of workers, doing our own
 * state-group-aware round-robin assignment (one sticky worker per session) so
 * a session's calls land on the same worker and can share cached adapters.
 */
export default abstract class WorkerPoolRpcDriver extends BaseRpcDriver {
  private lastWorkerAssignment = -1

  // sessionId -> worker number
  private workerAssignments = new Map<string, number>()

  private workerPool?: LazyWorker[]

  abstract makeWorker(): Promise<WorkerHandle>

  override freeSession(sessionId: string) {
    this.workerAssignments.delete(sessionId)
  }

  // terminate every pooled worker and reset assignment bookkeeping; call when
  // discarding the driver so its worker threads don't outlive it
  override destroy() {
    for (const worker of this.workerPool ?? []) {
      worker.destroy()
    }
    this.workerPool = undefined
    this.workerAssignments.clear()
    this.lastWorkerAssignment = -1
  }

  private createWorkerPool(): LazyWorker[] {
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

  private getWorkerPool() {
    return (this.workerPool ??= this.createWorkerPool())
  }

  async getWorker(sessionId: string): Promise<WorkerHandle> {
    const workers = this.getWorkerPool()
    let workerNumber = this.workerAssignments.get(sessionId)
    if (workerNumber === undefined) {
      workerNumber = (this.lastWorkerAssignment + 1) % workers.length
      this.workerAssignments.set(sessionId, workerNumber)
      this.lastWorkerAssignment = workerNumber
    }

    return workers[workerNumber]!.getWorker()
  }

  // shared worker dispatch: get this session's sticky worker, let plugins wrap
  // it, and hand off the already-serialized args
  protected async transport(
    pluginManager: PluginManager,
    sessionId: string,
    rpcMethod: RpcMethodType,
    serializedArgs: Record<string, unknown>,
    statusCallback: StatusCallback | undefined,
    options: Record<string, unknown>,
  ) {
    const unextendedWorker = await this.getWorker(sessionId)
    const worker = pluginManager.evaluateExtensionPoint(
      /** #extensionPoint Core-extendWorker | sync | Register extra RPC methods on the web worker */
      'Core-extendWorker',
      unextendedWorker,
    )
    return worker.call(rpcMethod.name, serializedArgs, {
      statusCallback,
      rpcDriverClassName: this.name,
      ...options,
    })
  }
}
