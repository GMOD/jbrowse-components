import Rpc from '@librpc/web'
import { objectFromEntries } from '../util'

function isClonable(thing) {
  if (typeof thing === 'function') return false
  if (thing instanceof Error) return false
  return true
}

// filter the given object and just remove any non-clonable things from it
function removeNonClonable(thing) {
  if (Array.isArray(thing)) {
    return thing.filter(isClonable).map(removeNonClonable)
  }
  if (typeof thing === 'object') {
    const newobj = objectFromEntries(
      Object.entries(thing)
        .filter(e => isClonable(e[1]))
        .map(([k, v]) => [k, removeNonClonable(v)]),
    )
    return newobj
  }
  return thing
}

export default class WebWorkerRpcDriver {
  lastWorkerAssignment = -1

  workerAssignments = {} // stateGroupName -> worker number

  constructor(pluginManager, { workers = [] }) {
    // note that we are making a Rpc.Client connection with a worker pool of one for each worker,
    // because we want to do our own load balancing rather than using librpc's builtin round-robin
    this.workers = workers.map(worker => new Rpc.Client({ workers: [worker] }))
    if (!this.workers.length) {
      throw new Error('no workers defined')
    }
  }

  getWorker(stateGroupName) {
    if (!this.workerAssignments[stateGroupName]) {
      const workerAssignment =
        (this.lastWorkerAssignment + 1) % this.workers.length
      this.workerAssignments[stateGroupName] = workerAssignment
      this.lastWorkerAssignment = workerAssignment
    }

    const worker = this.workers[this.workerAssignments[stateGroupName]]
    if (!worker) throw new Error(`no web workers registered for RPC`)
    return worker
  }

  call(pluginManager, stateGroupName, functionName, args, options = {}) {
    const worker = this.getWorker(stateGroupName)
    const filteredArgs = removeNonClonable(args)
    return worker.call(functionName, filteredArgs, {
      timeout: 3000,
      ...options,
    })
  }
}
