import { isAlive, isStateTreeNode } from 'mobx-state-tree'
import { objectFromEntries } from '../util'
import { serializeAbortSignal } from './remoteAbortSignals'
import PluginManager from '../PluginManager'

interface WorkerHandle {
  status?: string
  on?: (channel: string, callback: (message: string) => void) => void
  off?: (channel: string, callback: (message: string) => void) => void
  destroy(): void
  call(functionName: string, args?: unknown, options?: {}): Promise<unknown>
}

function isClonable(thing: unknown): boolean {
  if (typeof thing === 'function') return false
  if (thing instanceof Error) return false
  return true
}

const WORKER_MAX_PING_TIME = 30 * 1000

// watches the given worker object, returns a promise that will be rejected if
// the worker times out
export async function watchWorker(worker: WorkerHandle, pingTime: number) {
  // first ping call has no timeout, wait for worker download
  await worker.call('ping', [], { timeout: 100000000 })

  // after first ping succeeds, apply wait for timeout
  return new Promise((resolve, reject) => {
    function delay() {
      setTimeout(async () => {
        try {
          await worker.call('ping', [], { timeout: pingTime * 2 })
          delay()
        } catch (e) {
          reject(e)
        }
      }, pingTime)
    }
    delay()
  })
}

function detectHardwareConcurrency() {
  if (
    typeof window !== 'undefined' &&
    'hardwareConcurrency' in window.navigator
  ) {
    return window.navigator.hardwareConcurrency
  }
  return 1
}
class LazyWorker {
  worker?: WorkerHandle

  driver: BaseRpcDriver

  constructor(driver: BaseRpcDriver) {
    this.driver = driver
  }

  getWorker(pluginManager: PluginManager) {
    if (!this.worker) {
      const worker = this.driver.makeWorker(pluginManager)
      watchWorker(worker, WORKER_MAX_PING_TIME).catch(() => {
        if (this.worker) {
          console.warn('worker did not respond, killing and generating new one')
          this.worker.destroy()
          this.worker.status = 'killed'
          this.worker = undefined
        }
      })
      this.worker = worker
      return worker
    }
    return this.worker
  }
}

export default abstract class BaseRpcDriver {
  private lastWorkerAssignment = -1

  private workerAssignments = new Map<string, number>() // sessionId -> worker number

  private workerCount = 0

  abstract makeWorker(pluginManager: PluginManager): WorkerHandle

  private workerPool?: LazyWorker[]

  // filter the given object and just remove any non-clonable things from it
  filterArgs<THING_TYPE>(
    thing: THING_TYPE,
    pluginManager: PluginManager,
    sessionId: string,
  ): THING_TYPE {
    if (Array.isArray(thing)) {
      return (thing
        .filter(isClonable)
        .map(t =>
          this.filterArgs(t, pluginManager, sessionId),
        ) as unknown) as THING_TYPE
    }
    if (typeof thing === 'object' && thing !== null) {
      // AbortSignals are specially handled
      if (thing instanceof AbortSignal) {
        return (serializeAbortSignal(
          thing,
          this.remoteAbort.bind(this, pluginManager, sessionId),
        ) as unknown) as THING_TYPE
      }

      if (isStateTreeNode(thing) && !isAlive(thing))
        throw new Error('dead state tree node passed to RPC call')

      const newobj = objectFromEntries(
        Object.entries(thing)
          .filter(e => isClonable(e[1]))
          .map(([k, v]) => [k, this.filterArgs(v, pluginManager, sessionId)]),
      )
      return newobj as THING_TYPE
    }
    return thing
  }

  remoteAbort(
    pluginManager: PluginManager,
    sessionId: string,
    functionName: string,
    signalId: number,
  ) {
    const worker = this.getWorker(sessionId, functionName, pluginManager)
    worker.call(functionName, signalId, { timeout: 1000000 })
  }

  createWorkerPool(pluginManager: PluginManager): LazyWorker[] {
    const hardwareConcurrency = detectHardwareConcurrency()

    const workerCount =
      this.workerCount || Math.max(1, Math.ceil((hardwareConcurrency - 2) / 3))

    return [...new Array(workerCount)].map(() => new LazyWorker(this))
  }

  getWorkerPool(pluginManager: PluginManager) {
    if (!this.workerPool) {
      const res = this.createWorkerPool(pluginManager)
      this.workerPool = res
      return res // making this several steps makes TS happy
    }
    return this.workerPool
  }

  getWorker(
    sessionId: string,
    functionName: string,
    pluginManager: PluginManager,
  ): WorkerHandle {
    const workers = this.getWorkerPool(pluginManager)
    let workerNumber = this.workerAssignments.get(sessionId)
    if (workerNumber === undefined) {
      const workerAssignment = (this.lastWorkerAssignment + 1) % workers.length
      this.workerAssignments.set(sessionId, workerAssignment)
      this.lastWorkerAssignment = workerAssignment
      workerNumber = workerAssignment
    }

    // console.log(`${sessionId} -> worker ${workerNumber}`)
    const worker = workers[workerNumber].getWorker(pluginManager)
    if (!worker) {
      throw new Error('no web workers registered for RPC')
    }
    return worker
  }

  async call(
    pluginManager: PluginManager,
    sessionId: string,
    functionName: string,
    args: { statusCallback?: Function },
    options = {},
  ) {
    if (!sessionId) {
      throw new TypeError('sessionId is required')
    }
    const worker = this.getWorker(sessionId, functionName, pluginManager)
    const rpcMethod = pluginManager.getRpcMethodType(functionName)
    const serializedArgs = await rpcMethod.serializeArguments(args)
    const filteredAndSerializedArgs = this.filterArgs(
      serializedArgs,
      pluginManager,
      sessionId,
    )

    // now actually call the worker
    const callP = worker.call(functionName, filteredAndSerializedArgs, {
      timeout: 5 * 60 * 1000, // 5 minutes
      statusCallback: args.statusCallback,
      ...options,
    })

    // check every 5 seconds to see if the worker has been killed, and
    // reject the killedP promise if it has
    let killedCheckInterval: ReturnType<typeof setInterval>
    const killedP = new Promise((resolve, reject) => {
      killedCheckInterval = setInterval(() => {
        // must've been killed
        if (worker.status === 'killed') {
          reject(
            new Error('operation timed out, worker process stopped responding'),
          )
        }
      }, 5000)
    })

    // the result is a race between the actual result promise, and the "killed"
    // promise. the killed promise will only actually win if the worker was
    // killed before the call could return
    const resultP = Promise.race([callP, killedP])
    resultP.finally(() => {
      clearInterval(killedCheckInterval)
    })

    return rpcMethod.deserializeReturn(await resultP)
  }
}
