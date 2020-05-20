import { isAlive, isStateTreeNode } from 'mobx-state-tree'
import { objectFromEntries } from '../util'
import { serializeAbortSignal } from './remoteAbortSignals'
import PluginManager from '../PluginManager'

interface WorkerHandle {
  destroy(): void
  call(functionName: string, args?: unknown, options?: {}): Promise<unknown>
}

function isClonable(thing: unknown): boolean {
  if (typeof thing === 'function') return false
  if (thing instanceof Error) return false
  return true
}

const WORKER_MAX_PING_TIME = 30 * 1000 // 30 secs

// watches the given worker object, returns a promise that will be rejected if
// the worker times out
function watchWorker(worker: WorkerHandle, pingTime: number): Promise<void> {
  return new Promise((resolve, reject): void => {
    let pingIsOK = true
    const watcherInterval = setInterval(() => {
      if (!pingIsOK) {
        clearInterval(watcherInterval)
        reject(
          new Error(
            `worker look longer than ${pingTime} ms to respond. terminated.`,
          ),
        )
      } else {
        pingIsOK = false
        worker
          .call('ping', [], { timeout: 2 * WORKER_MAX_PING_TIME })
          .then(() => {
            pingIsOK = true
          })
      }
    }, pingTime)
  })
}

function detectHardwareConcurrency() {
  // if (
  //   typeof window !== 'undefined' &&
  //   'hardwareConcurrency' in window.navigator
  // ) {
  //   return window.navigator.hardwareConcurrency
  // }
  return 1
}

export default abstract class BaseRpcDriver {
  private lastWorkerAssignment = -1

  private workerAssignments = new Map() // stateGroupName -> worker number

  private workerCount = 0

  abstract makeWorker(): WorkerHandle

  private workerPool?: WorkerHandle[]

  // filter the given object and just remove any non-clonable things from it
  filterArgs<THING_TYPE>(
    thing: THING_TYPE,
    pluginManager: PluginManager,
    stateGroupName: string,
  ): THING_TYPE {
    if (Array.isArray(thing)) {
      return (thing
        .filter(isClonable)
        .map(t =>
          this.filterArgs(t, pluginManager, stateGroupName),
        ) as unknown) as THING_TYPE
    }
    if (typeof thing === 'object' && thing !== null) {
      // AbortSignals are specially handled
      if (thing instanceof AbortSignal) {
        return (serializeAbortSignal(
          thing,
          this.remoteAbort.bind(this, pluginManager),
        ) as unknown) as THING_TYPE
      }

      if (isStateTreeNode(thing) && !isAlive(thing))
        throw new Error('dead state tree node passed to RPC call')

      const newobj = objectFromEntries(
        Object.entries(thing)
          .filter(e => isClonable(e[1]))
          .map(([k, v]) => [
            k,
            this.filterArgs(v, pluginManager, stateGroupName),
          ]),
      )
      return newobj as THING_TYPE
    }
    return thing
  }

  remoteAbort(
    pluginManager: PluginManager,
    functionName: string,
    signalId: number,
  ) {
    // TODO: this is not the right state group name!
    const worker = this.getWorker('remoteAbort', functionName, pluginManager)
    worker.call(functionName, signalId)
  }

  createWorkerPool(): WorkerHandle[] {
    const hardwareConcurrency = detectHardwareConcurrency()

    const workerCount =
      this.workerCount || Math.max(1, Math.ceil(hardwareConcurrency / 2))

    const workerHandles: WorkerHandle[] = new Array(workerCount)
    for (let i = 0; i < workerCount; i += 1) {
      workerHandles[i] = this.makeWorker()
    }

    const watchAndReplaceWorker = (
      worker: WorkerHandle,
      workerIndex: number,
    ): void => {
      watchWorker(worker, WORKER_MAX_PING_TIME).catch(() => {
        console.warn(
          `worker ${
            workerIndex + 1
          } did not respond within ${WORKER_MAX_PING_TIME} ms, terminating and replacing.`,
        )
        worker.destroy()
        workerHandles[workerIndex] = this.makeWorker()
        watchAndReplaceWorker(workerHandles[workerIndex], workerIndex)
      })
    }

    // for each worker, make a ping timer that will kill it and start a new one if it does not
    // respond to a ping within a certain time
    workerHandles.forEach(watchAndReplaceWorker)

    return workerHandles
  }

  getWorkerPool(): WorkerHandle[] {
    if (!this.workerPool) {
      this.workerPool = this.createWorkerPool()
    }
    return this.workerPool
  }

  getWorker(
    stateGroupName: string,
    functionName: string,
    pluginManager: PluginManager,
  ): WorkerHandle {
    const workers = this.getWorkerPool()
    if (!this.workerAssignments.has(stateGroupName)) {
      const workerAssignment = (this.lastWorkerAssignment + 1) % workers.length
      this.workerAssignments.set(stateGroupName, workerAssignment)
      this.lastWorkerAssignment = workerAssignment
    }

    const workerNumber = this.workerAssignments.get(stateGroupName)
    // console.log(stateGroupName, workerNumber)
    const worker = workers[workerNumber]
    if (!worker) {
      throw new Error('no web workers registered for RPC')
    }
    return worker
  }

  async call(
    pluginManager: PluginManager,
    stateGroupName: string,
    functionName: string,
    args: {},
    options = {},
  ) {
    if (!stateGroupName) {
      throw new TypeError('stateGroupName is required')
    }
    const worker = this.getWorker(stateGroupName, functionName, pluginManager)
    const rpcMethod = pluginManager.getRpcMethodType(functionName)
    const serializedArgs = await rpcMethod.serializeArguments(args)
    const filteredAndSerializedArgs = this.filterArgs(
      serializedArgs,
      pluginManager,
      stateGroupName,
    )
    const result = await worker.call(functionName, filteredAndSerializedArgs, {
      timeout: 5 * 60 * 1000, // 5 minutes
      ...options,
    })
    return rpcMethod.deserializeReturn(result)
  }
}
