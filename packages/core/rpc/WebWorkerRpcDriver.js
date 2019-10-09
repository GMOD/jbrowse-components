import Rpc from '@librpc/web'

import { isStateTreeNode, isAlive } from 'mobx-state-tree'
import { objectFromEntries } from '../util'
import { serializeAbortSignal } from './remoteAbortSignals'

function isClonable(thing) {
  if (typeof thing === 'function') return false
  if (thing instanceof Error) return false
  return true
}

const WORKER_MAX_PING_TIME = 30 * 1000 // 30 secs

// watches the given worker object, returns a promise that will be rejected if
// the worker times out
function watchWorker(rpcWorkerHandle, pingTime) {
  return new Promise((resolve, reject) => {
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
        rpcWorkerHandle.call('ping').then(() => {
          pingIsOK = true
        })
      }
    }, pingTime)
  })
}

function createWorkerPool(WorkerClass, configuredWorkerCount = 0) {
  const hardwareConcurrency =
    typeof window !== 'undefined' ? window.navigator.hardwareConcurrency : 2
  const workerCount =
    configuredWorkerCount || Math.max(1, hardwareConcurrency - 2)

  // note that we are making a Rpc.Client connection with a worker pool of one for each worker,
  // because we want to do our own state-group-aware load balancing rather than using librpc's
  // builtin round-robin
  function makeWorker() {
    return new Rpc.Client({ workers: [new WorkerClass()] })
  }

  const workerHandles = new Array(workerCount)
  for (let i = 0; i < workerCount; i += 1) {
    workerHandles[i] = makeWorker()
  }

  function watchAndReplaceWorker(rpcWorkerHandle, workerIndex) {
    watchWorker(rpcWorkerHandle, WORKER_MAX_PING_TIME).catch(() => {
      console.warn(
        `worker ${workerIndex +
          1} did not respond within ${WORKER_MAX_PING_TIME} ms, terminating and replacing.`,
      )
      rpcWorkerHandle.workers[0].terminate()
      workerHandles[workerIndex] = makeWorker()
      watchAndReplaceWorker(workerHandles[workerIndex], workerIndex)
    })
  }

  // for each worker, make a ping timer that will kill it and start a new one if it does not
  // respond to a ping within a certain time
  workerHandles.forEach(watchAndReplaceWorker)

  return workerHandles
}

export default class WebWorkerRpcDriver {
  lastWorkerAssignment = -1

  workerAssignments = new Map() // stateGroupName -> worker number

  workerPool = undefined

  constructor({ WorkerClass }) {
    this.WorkerClass = WorkerClass
  }

  // filter the given object and just remove any non-clonable things from it
  filterArgs(thing, pluginManager, stateGroupName) {
    if (Array.isArray(thing)) {
      return thing
        .filter(isClonable)
        .map(t => this.filterArgs(t, pluginManager, stateGroupName))
    }
    if (typeof thing === 'object') {
      // AbortSignals are specially handled
      if (thing instanceof AbortSignal) {
        return serializeAbortSignal(
          thing,
          this.call.bind(this, pluginManager, stateGroupName),
        )
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
      return newobj
    }
    return thing
  }

  getWorkerPool(configuredWorkerCount) {
    if (!this.workerPool) {
      this.workerPool = createWorkerPool(
        this.WorkerClass,
        configuredWorkerCount,
      )
    }
    return this.workerPool
  }

  getWorker(stateGroupName) {
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

  call(pluginManager, stateGroupName, functionName, args, options = {}) {
    if (stateGroupName === undefined) {
      throw new TypeError('stateGroupName is required')
    }
    const worker = this.getWorker(stateGroupName)
    const filteredArgs = this.filterArgs(args, pluginManager, stateGroupName)
    return worker.call(functionName, filteredArgs, {
      timeout: 5 * 60 * 1000, // 5 minutes
      ...options,
    })
  }
}
