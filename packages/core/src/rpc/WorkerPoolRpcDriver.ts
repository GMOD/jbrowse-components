import { readConfObject } from '../configuration/index.ts'
import { clamp } from '../util/index.ts'
import { registerStopTokenBroadcaster } from '../util/stopToken.ts'
import BaseRpcDriver, { CORE_FREE_RESOURCES } from './BaseRpcDriver.ts'

import type PluginManager from '../PluginManager.ts'
import type RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
import type { StatusCallback } from '../util/progress.ts'

export interface WorkerHandle {
  destroy(): void
  // fires when the worker dies, so the pool can drop and re-boot the slot;
  // drivers with no such failure mode omit it
  onError?(callback: () => void): void
  // forwards a stopped stop-token id so calls running there can abort; a
  // transport with no out-of-band channel omits it and keeps whatever
  // cancellation its calls already have
  notifyStopToken?(id: string): void
  call(
    functionName: string,
    args?: unknown,
    options?: {
      // out-of-band progress handle; carries a determinate StatusWithProgress
      // object as readily as a plain string label (see WebWorkerHandle.call)
      statusCallback?: StatusCallback
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
  // fall back to 1 if navigator.hardwareConcurrency is absent, else clamp()
  // sees NaN and collapses the pool to zero workers
  return typeof navigator === 'undefined'
    ? 1
    : navigator.hardwareConcurrency || 1
}

class LazyWorker {
  workerP?: Promise<WorkerHandle>

  constructor(public driver: WorkerPoolRpcDriver) {}

  async getWorker() {
    if (!this.workerP) {
      const p = this.driver.makeWorker()
      this.workerP = p
      // drop this slot so the next getWorker re-boots, whether the boot failed
      // or the booted worker later died (a dead worker never replies)
      const invalidate = () => {
        if (this.workerP === p) {
          this.workerP = undefined
        }
      }
      p.then(worker => {
        worker.onError?.(() => {
          invalidate()
          worker.destroy()
        })
      }).catch(invalidate)
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

  /**
   * Forward a stopped token id, but never boot a worker to do it: an unbooted
   * slot is running nothing to cancel. Routed through the same promise the
   * dispatching call awaits, so a stop issued while this slot is still booting
   * still lands after the call it means to cancel rather than ahead of the
   * worker's message listener existing.
   */
  notifyStopToken(id: string) {
    this.workerP
      ?.then(worker => {
        worker.notifyStopToken?.(id)
      })
      .catch(() => {})
  }

  /**
   * Drop a session's cached adapters on this slot's worker — and, like
   * {@link notifyStopToken}, never boot one to do it. A slot that never booted
   * has no cache to free, and booting one there costs a whole worker bundle and
   * every runtime plugin to say so.
   *
   * Awaited rather than fire-and-forget, because a caller can be waiting to
   * know the adapter is gone; a slot still booting frees once it lands.
   */
  async freeSession(sessionId: string) {
    const worker = await this.workerP?.catch(() => undefined)
    await worker?.call(CORE_FREE_RESOURCES, { sessionId })
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

  // `Core-extendWorker` answers "what is this worker", not "what is this call",
  // and it is handed no props to tell one call from the next. Firing it per
  // dispatch built a plugin's wrapper afresh for every RPC — so a wrapper
  // holding per-worker state (a pending-call table, a registered method map)
  // was thrown away before its second use, and a callback that extends by
  // mutating the handle re-ran its registration on every call. Memoized on the
  // handle instead, so the fold runs once per booted worker; a slot that
  // re-boots hands back a new handle and extends that one.
  private extendedWorkers = new WeakMap<WorkerHandle, WorkerHandle>()

  // a stopped token has to reach the thread actually running the work, and this
  // is the seam that carries it. Broadcast rather than routed per call: one
  // token is commonly in flight on several calls at once, and a worker holding
  // nothing under that id ignores the frame.
  //
  // Registered with the POOL, not in the constructor, so that a driver which
  // never boots a worker stays out of the module-global broadcaster set — and
  // registered only once the pool exists to receive the broadcast, since a
  // `createWorkerPool` that threw after registering left an entry no `destroy`
  // could ever reach.
  private unregisterBroadcaster: () => void = () => {}

  // `destroy` is terminal: `getWorkerPool` refuses rather than letting its `??=`
  // build a second pool for a driver whose teardown already ran. ADR-086.
  private destroyed = false

  abstract makeWorker(): Promise<WorkerHandle>

  /**
   * Free the session on the worker it was assigned to, and drop the assignment
   * so it doesn't accumulate for the life of the driver.
   *
   * A session with no assignment never dispatched anything, so there is nothing
   * cached anywhere to free — and no pool to build in order to find that out.
   */
  override async freeSession(_pluginManager: PluginManager, sessionId: string) {
    const workerNumber = this.workerAssignments.get(sessionId)
    this.workerAssignments.delete(sessionId)
    if (workerNumber !== undefined) {
      await this.workerPool?.[workerNumber]?.freeSession(sessionId)
    }
  }

  // terminate every pooled worker and reset assignment bookkeeping; call when
  // discarding the driver so its worker threads don't outlive it
  override destroy() {
    this.destroyed = true
    this.unregisterBroadcaster()
    for (const worker of this.workerPool ?? []) {
      worker.destroy()
    }
    this.workerPool = undefined
    this.workerAssignments.clear()
    this.lastWorkerAssignment = -1
  }

  private createWorkerPool(): LazyWorker[] {
    // workerCount 0 (the config default) means "decide from hardware"
    const workerCount =
      readConfObject(this.config, 'workerCount') ||
      clamp(detectHardwareConcurrency() - 1, 1, 5)

    const pool = Array.from({ length: workerCount }, () => new LazyWorker(this))
    this.unregisterBroadcaster = registerStopTokenBroadcaster(id => {
      for (const worker of pool) {
        worker.notifyStopToken(id)
      }
    })
    return pool
  }

  private getWorkerPool() {
    if (this.destroyed) {
      throw new Error(`${this.name} was destroyed`)
    }
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
  ) {
    const unextendedWorker = await this.getWorker(sessionId)
    let worker = this.extendedWorkers.get(unextendedWorker)
    if (!worker) {
      worker = pluginManager.evaluateExtensionPoint(
        /** #extensionPoint Core-extendWorker | sync | Register extra RPC methods on the web worker. Fired once per booted worker, not per call */
        'Core-extendWorker',
        unextendedWorker,
      )
      this.extendedWorkers.set(unextendedWorker, worker)
    }
    return worker.call(rpcMethod.name, serializedArgs, { statusCallback })
  }
}
