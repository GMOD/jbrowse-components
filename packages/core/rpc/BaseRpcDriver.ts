import { isAlive, isStateTreeNode } from 'mobx-state-tree'
import { clamp } from '../util'
import { serializeAbortSignal } from './remoteAbortSignals'
import PluginManager from '../PluginManager'
import { readConfObject, AnyConfigurationModel } from '../configuration'

export interface WorkerHandle {
  status?: string
  error?: Error
  on?: (channel: string, callback: (message: string) => void) => void
  off?: (channel: string, callback: (message: string) => void) => void
  destroy(): void
  call(
    functionName: string,
    args?: unknown,
    options?: {
      statusCallback?(message: string): void
      timeout?: number
      rpcDriverClassName: string
    },
  ): Promise<unknown>
}

export interface RpcDriverConstructorArgs {
  config: AnyConfigurationModel
}

function isClonable(thing: unknown): boolean {
  if (typeof thing === 'function') {
    return false
  }
  if (thing instanceof Error) {
    return false
  }
  return true
}

// watches the given worker object, returns a promise that will be rejected if
// the worker times out
export async function watchWorker(
  worker: WorkerHandle,
  pingTime: number,
  rpcDriverClassName: string,
) {
  // after first ping succeeds, apply wait for timeout
  return new Promise((_resolve, reject) => {
    function delay() {
      setTimeout(async () => {
        try {
          await worker.call('ping', [], {
            timeout: pingTime * 2,
            rpcDriverClassName,
          })
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
  const mainThread = typeof window !== 'undefined'
  const canDetect = mainThread && 'hardwareConcurrency' in window.navigator
  if (mainThread && canDetect) {
    return window.navigator.hardwareConcurrency
  }
  return 1
}
class LazyWorker {
  workerP?: Promise<WorkerHandle> | undefined

  constructor(public driver: BaseRpcDriver) {}

  async getWorker() {
    if (!this.workerP) {
      this.workerP = this.driver
        .makeWorker()
        .then(worker => {
          watchWorker(worker, this.driver.maxPingTime, this.driver.name).catch(
            error => {
              if (worker) {
                console.error(
                  'worker did not respond, killing and generating new one',
                )
                console.error(error)
                worker.destroy()
                worker.status = 'killed'
                worker.error = error
                this.workerP = undefined
              }
            },
          )
          return worker
        })
        .catch(e => {
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

  private workerAssignments = new Map<string, number>() // sessionId -> worker number

  abstract makeWorker(): Promise<WorkerHandle>

  private workerPool?: LazyWorker[]

  maxPingTime = 30000

  workerCheckFrequency = 5000

  config: AnyConfigurationModel

  constructor(args: RpcDriverConstructorArgs) {
    this.config = args.config
  }

  // filter the given object and just remove any non-clonable things from it
  filterArgs<THING_TYPE>(
    thing: THING_TYPE,
    sessionId: string,
    depth = 0,
  ): THING_TYPE {
    if (Array.isArray(thing)) {
      return thing
        .filter(isClonable)
        .map(t =>
          this.filterArgs(t, sessionId, depth + 1),
        ) as unknown as THING_TYPE
    }
    if (typeof thing === 'object' && thing !== null) {
      // AbortSignals are specially handled
      if (thing instanceof AbortSignal) {
        return serializeAbortSignal(
          thing,
          this.remoteAbort.bind(this, sessionId),
        ) as unknown as THING_TYPE
      }

      if (isStateTreeNode(thing) && !isAlive(thing)) {
        throw new Error('dead state tree node passed to RPC call')
      }

      // special case, don't try to iterate the file's subelements as the
      // object entries below would
      if (thing instanceof File) {
        return thing
      }

      return Object.fromEntries(
        Object.entries(thing)
          .filter(e => isClonable(e[1]))
          .map(([k, v]) => [k, this.filterArgs(v, sessionId, depth + 1)]),
      ) as THING_TYPE
    }
    return thing
  }

  async remoteAbort(sessionId: string, functionName: string, signalId: number) {
    const worker = await this.getWorker(sessionId)
    worker.call(
      functionName,
      { signalId },
      { timeout: 1000000, rpcDriverClassName: this.name },
    )
  }

  createWorkerPool(): LazyWorker[] {
    const hardwareConcurrency = detectHardwareConcurrency()

    const workerCount =
      readConfObject(this.config, 'workerCount') ||
      clamp(1, Math.max(1, hardwareConcurrency - 1), 5)

    return [...new Array(workerCount)].map(() => new LazyWorker(this))
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

    // console.log(`${sessionId} -> worker ${workerNumber}`)
    const worker = workers[workerNumber].getWorker()
    if (!worker) {
      throw new Error('no web workers registered for RPC')
    }
    return worker
  }

  async call(
    pluginManager: PluginManager,
    sessionId: string,
    functionName: string,
    args: { statusCallback?: (message: string) => void },
    options = {},
  ) {
    if (!sessionId) {
      throw new TypeError('sessionId is required')
    }
    let done = false
    const worker = await this.getWorker(sessionId)
    const rpcMethod = pluginManager.getRpcMethodType(functionName)
    const serializedArgs = await rpcMethod.serializeArguments(args, this.name)
    const filteredAndSerializedArgs = this.filterArgs(serializedArgs, sessionId)

    // now actually call the worker
    const callP = worker
      .call(functionName, filteredAndSerializedArgs, {
        timeout: 5 * 60 * 1000, // 5 minutes
        statusCallback: args.statusCallback,
        rpcDriverClassName: this.name,
        ...options,
      })
      .finally(() => {
        done = true
      })

    // check every 5 seconds to see if the worker has been killed, and
    // reject the killedP promise if it has
    let killedCheckInterval: ReturnType<typeof setInterval>
    const killedP = new Promise((resolve, reject) => {
      killedCheckInterval = setInterval(() => {
        // must've been killed
        if (worker.status === 'killed') {
          reject(
            new Error(
              `operation timed out, worker process stopped responding, ${worker.error}`,
            ),
          )
        } else if (done) {
          resolve(true)
        }
      }, this.workerCheckFrequency)
    }).finally(() => {
      clearInterval(killedCheckInterval)
    })

    // the result is a race between the actual result promise, and the "killed"
    // promise. the killed promise will only actually win if the worker was
    // killed before the call could return
    const resultP = Promise.race([callP, killedP])
    return rpcMethod.deserializeReturn(resultP, args, this.name)
  }
}
