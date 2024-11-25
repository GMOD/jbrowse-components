import { isAlive, isStateTreeNode } from 'mobx-state-tree'
import { readConfObject } from '../configuration'
import { clamp } from '../util'
import type PluginManager from '../PluginManager'
import type { AnyConfigurationModel } from '../configuration'

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
      timeout?: number
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

// watches the given worker object, returns a promise that will be rejected if
// the worker times out
export async function watchWorker(
  worker: WorkerHandle,
  pingTime: number,
  rpcDriverClassName: string,
) {
  // after first ping succeeds, apply wait for timeout

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    await worker.call('ping', [], {
      timeout: pingTime * 2,
      rpcDriverClassName,
    })
    await new Promise(resolve => setTimeout(resolve, pingTime))
  }
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
            (error: unknown) => {
              console.error(
                'worker did not respond, killing and generating new one',
              )
              console.error(error)
              worker.destroy()
              worker.status = 'killed'
              worker.error = error
              this.workerP = undefined
            },
          )
          return worker
        })
        .catch((e: unknown) => {
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

  maxPingTime = 30000

  workerCheckFrequency = 5000

  config: AnyConfigurationModel

  constructor(args: RpcDriverConstructorArgs) {
    this.config = args.config
  }

  // filter the given object and just remove any non-cloneable things from it
  filterArgs<THING_TYPE>(thing: THING_TYPE, sessionId: string): THING_TYPE {
    if (Array.isArray(thing)) {
      return thing
        .filter(thing => isCloneable(thing))
        .map(t => this.filterArgs(t, sessionId)) as unknown as THING_TYPE
    } else if (typeof thing === 'object' && thing !== null) {
      if (isStateTreeNode(thing) && !isAlive(thing)) {
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
    } else {
      return thing
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
      { timeout: 1000000, rpcDriverClassName: this.name },
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
    let done = false
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
