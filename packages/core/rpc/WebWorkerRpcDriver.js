import Rpc from '@librpc/web'

import { objectFromEntries } from '../util'
import { serializeAbortSignal } from './remoteAbortSignals'

function isClonable(thing) {
  if (typeof thing === 'function') return false
  if (thing instanceof Error) return false
  return true
}

const MAX_WORKERS = 6

// keep global pools of each worker class
const workerPools = new Map()
function getWorkers(WorkerClass) {
  if (!workerPools.has(WorkerClass)) {
    const hardwareConcurrency =
      typeof window !== 'undefined' ? window.navigator.hardwareConcurrency : 2
    const workerCount = Math.min(MAX_WORKERS, hardwareConcurrency)
    const workers = new Array(workerCount)
    for (let i = 0; i < workerCount; i += 1) {
      workers[i] = new WorkerClass()
    }

    // note that we are making a Rpc.Client connection with a worker pool of one for each worker,
    // because we want to do our own state-group-aware load balancing rather than using librpc's
    // builtin round-robin
    workerPools.set(
      WorkerClass,
      workers.map(worker => new Rpc.Client({ workers: [worker] })),
    )
  }
  return workerPools.get(WorkerClass)
}

export default class WebWorkerRpcDriver {
  lastWorkerAssignment = -1

  workerAssignments = {} // stateGroupName -> worker number

  constructor(pluginManager, { WorkerClass }) {
    this.WorkerClass = WorkerClass
  }

  // filter the given object and just remove any non-clonable things from it
  filterArgs(thing, pluginManager, stateGroupName) {
    if (Array.isArray(thing)) {
      return thing.filter(isClonable).map(this.filterArgs, this)
    }
    if (typeof thing === 'object') {
      // AbortSignals are specially handled
      if (thing instanceof AbortSignal) {
        return serializeAbortSignal(
          thing,
          this.call.bind(this, pluginManager, stateGroupName),
        )
      }

      const newobj = objectFromEntries(
        Object.entries(thing)
          .filter(e => isClonable(e[1]))
          .map(([k, v]) => [k, this.filterArgs(v)]),
      )
      return newobj
    }
    return thing
  }

  getWorker(stateGroupName) {
    const workers = getWorkers(this.WorkerClass)
    if (!this.workerAssignments[stateGroupName]) {
      const workerAssignment = (this.lastWorkerAssignment + 1) % workers.length
      this.workerAssignments[stateGroupName] = workerAssignment
      this.lastWorkerAssignment = workerAssignment
    }

    const workerNumber = this.workerAssignments[stateGroupName]
    // console.log(stateGroupName, workerNumber)
    const worker = workers[workerNumber]
    if (!worker) throw new Error('no web workers registered for RPC')
    return worker
  }

  call(pluginManager, stateGroupName, functionName, args, options = {}) {
    const worker = this.getWorker(stateGroupName)
    const filteredArgs = this.filterArgs(args, pluginManager, stateGroupName)
    return worker.call(functionName, filteredArgs, {
      timeout: 5 * 60 * 1000, // 5 minutes
      ...options,
    })
  }
}
