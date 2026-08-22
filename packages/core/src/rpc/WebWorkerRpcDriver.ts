import { readConfObject } from '../configuration/index.ts'
import { clamp } from '../util/index.ts'
import { registerStopTokenBroadcaster } from '../util/stopToken.ts'
import BaseRpcDriver, { CORE_FREE_RESOURCES } from './BaseRpcDriver.ts'
import RpcClient from './RpcClient.ts'
import { deserializeError } from './serializeError/index.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
import type { PluginDefinition } from '../pluginDefinitions.ts'
import type { RpcStatus, StatusCallback } from '../util/progress.ts'

export interface WorkerHandle {
  destroy(): void
  // fires when the worker dies, so the pool can drop and re-boot the slot;
  // drivers with no such failure mode omit it
  onError?(callback: () => void): void
  // forwards a stopped stop-token id so calls running there can abort; a
  // transport with no out-of-band channel omits it and keeps whatever
  // cancellation its calls already have
  notifyStopToken?(id: string): void
  // Hear a named event this worker emits out of band (`RpcServer.emit`), and
  // send it something outside the RPC framing. The pair is what a
  // `Core-extendWorker` plugin needs to run a request/response of its own
  // across the boundary — jbrowse-plugin-apollo's worker-side sequence adapter
  // asks the main thread for sequence this way. Declared because they were
  // being reached anyway, through a `private client` and a public `worker`
  // that this interface promised nothing about.
  on?(eventName: string, listener: (data: unknown) => void): void
  postMessage?(message: unknown): void
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

export interface WebWorkerRpcDriverOptions {
  makeWorkerInstance: () => Worker
  plugins: PluginDefinition[]
  windowHref: string
  numberGrouping: boolean
}

function detectHardwareConcurrency() {
  // fall back to 1 if navigator.hardwareConcurrency is absent, else clamp()
  // sees NaN and collapses the pool to zero workers
  return typeof navigator === 'undefined'
    ? 1
    : navigator.hardwareConcurrency || 1
}

class WebWorkerHandle {
  private client: RpcClient

  // a counter, not a nanoid: the listener map a channel keys into is this
  // handle's own client, so that is the only scope uniqueness is needed in, and
  // the nanoid was a crypto.getRandomValues per reporting call
  private channelCount = 0

  constructor(private worker: Worker) {
    this.client = new RpcClient(worker)
    // Listen for worker errors that might not be caught by RpcClient
    this.client.on('error', error => {
      console.error('[WebWorker RPC Error]', error)
    })
  }

  destroy() {
    // reject in-flight calls before terminating, else they wait on a reply the
    // dead worker can never send
    this.client.destroy()
    this.worker.terminate()
  }

  // lets the pool discard this handle once the worker throws a fatal error
  onError(callback: () => void) {
    this.client.on('error', callback)
  }

  notifyStopToken(id: string) {
    this.client.notifyStopToken(id)
  }

  // the two halves of {@link WorkerHandle}'s plugin-facing pair
  on(eventName: string, listener: (data: unknown) => void) {
    this.client.on(eventName, listener)
  }

  postMessage(message: unknown) {
    this.worker.postMessage(message)
  }

  /**
   * A `channel` only when the caller asked for status, so that "no
   * statusCallback" survives the worker boundary.
   *
   * It did not. The channel was minted unconditionally, and `wrapForRpc` builds
   * the worker's `statusCallback` from whatever channel it is handed — so every
   * method in every worker ran with a live status handle whoever called it had
   * declined, and `MainThreadRpcDriver` (which passes the caller's own
   * `undefined` straight through) answered the same question differently. That
   * asymmetry is the one {@link RpcManager}'s `call` docstring already records
   * in the other direction.
   *
   * The absence is not cosmetic — it is a documented branch. `downloadStatus`
   * hands the reader no `onProgress` without a callback, `createProgressReporter`
   * skips its emit, and every status the worker did send crossed a postMessage
   * to reach a listener that dropped it.
   *
   * The postMessage traffic and the symmetry are the whole case; the read speed
   * is not. `res.bytes()` is the SLOWER of the two reads under ~10MB —
   * agent-docs/measurements/download-read-path.json — and an earlier revision of
   * this comment claimed the opposite because four other places in the tree did.
   */
  async call(
    funcName: string,
    args: Record<string, unknown>,
    // defaulted, not required: {@link WorkerHandle} declares it optional, and a
    // `Core-extendWorker` wrapper written against that interface may well call
    // `worker.call(name, args)` — which destructured `undefined` and threw
    opts: { statusCallback?: StatusCallback } = {},
  ) {
    const { statusCallback } = opts
    if (!statusCallback) {
      return this.client.call(funcName, args)
    }
    const channel = `message-${++this.channelCount}`
    // RpcClient is a generic event emitter (it also carries 'error' events), so
    // its listeners see `unknown`. This channel is dedicated to one method's
    // status emits, which the worker only ever posts as RpcStatus (see
    // wrapForRpc in rpcWorker.ts), so narrowing to RpcStatus here is sound.
    const listener = (message: unknown) => {
      statusCallback(message as RpcStatus)
    }
    this.client.on(channel, listener)
    try {
      const result = await this.client.call(funcName, { ...args, channel })
      return result
    } finally {
      this.client.off(channel, listener)
    }
  }
}

class LazyWorker {
  /**
   * The handle this slot booted, and what the pool drives the worker's LIFE on
   * — the error hook and the termination.
   *
   * Kept apart from {@link workerP} because a `Core-extendWorker` plugin only
   * has to forward `call`: `WorkerHandle` makes `onError` and the rest
   * optional, so a conforming wrapper (a spread plus a `call`, which is the
   * obvious way to write one) drops them. Driving the re-boot through such a
   * wrapper means a dead worker is never noticed and the slot never re-boots.
   */
  private bootP?: Promise<WorkerHandle>

  /** What `Core-extendWorker` returned for it: where calls go. */
  workerP?: Promise<WorkerHandle>

  constructor(public driver: WebWorkerRpcDriver) {}

  async getWorker() {
    if (!this.workerP) {
      const booted = this.driver.makeWorker()
      this.bootP = booted
      // once per booted worker by construction, rather than per dispatch behind
      // a memo
      this.workerP = booted.then(worker => this.driver.extendWorker(worker))
      // drop this slot so the next getWorker re-boots, whether the boot failed
      // or the booted worker later died (a dead worker never replies)
      const invalidate = () => {
        if (this.bootP === booted) {
          this.bootP = undefined
          this.workerP = undefined
        }
      }
      booted
        .then(worker => {
          worker.onError?.(() => {
            invalidate()
            worker.destroy()
          })
        })
        .catch(invalidate)
    }
    return this.workerP
  }

  destroy() {
    // terminate the underlying worker once it resolves; a worker that never
    // booted (rejected promise) has nothing to terminate, so swallow that
    this.bootP
      ?.then(worker => {
        worker.destroy()
      })
      .catch(() => {})
    this.bootP = undefined
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
    this.bootP
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
   * Through the extended handle, because it is a `call`: a plugin that wraps
   * calls should see this one.
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
 * Runs RPC methods in a pool of lazily-booted web workers, with our own
 * state-group-aware round-robin assignment (one sticky worker per session) so a
 * session's calls land on the same worker and can share cached adapters.
 *
 * The pool is here rather than in a `WorkerPoolRpcDriver` above it: that base
 * abstracted `makeWorker`, which has one implementation. It is a plain
 * overridable method now, which is all the seam was ever used for. ADR-086.
 */
export default class WebWorkerRpcDriver extends BaseRpcDriver {
  name = 'WebWorkerRpcDriver'

  private lastWorkerAssignment = -1

  // sessionId -> worker number
  private workerAssignments = new Map<string, number>()

  private workerPool?: LazyWorker[]

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

  constructor(
    pluginManager: PluginManager,
    config: AnyConfigurationModel,
    private options: WebWorkerRpcDriverOptions,
  ) {
    super(pluginManager, config)
  }

  /**
   * Free the session on the worker it was assigned to, and drop the assignment
   * so it doesn't accumulate for the life of the driver.
   *
   * A session with no assignment never dispatched anything, so there is nothing
   * cached anywhere to free — and no pool to build in order to find that out.
   */
  override async freeSession(sessionId: string) {
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

  /**
   * Hand a freshly booted worker to whatever plugins want to extend it, and use
   * whatever comes back as the pooled handle.
   *
   * Called from {@link LazyWorker.getWorker} rather than from `makeWorker`,
   * which subclasses override — a seam that skipped the fold would silently
   * un-extend every worker. It answers "what is this worker", not "what is this
   * call", so folding at dispatch needed a WeakMap to stop rebuilding a
   * plugin's wrapper per RPC; once per boot has nothing to memoize.
   */
  extendWorker(worker: WorkerHandle) {
    return this.pluginManager.evaluateExtensionPoint(
      /** #extensionPoint Core-extendWorker | sync | Take a booted RPC web worker: subscribe to the events it emits, post to it, or wrap its `call`. Fired once per booted worker, not per call */
      'Core-extendWorker',
      worker,
    )
  }

  // get this session's sticky worker and hand off the already-serialized args
  protected async transport(
    sessionId: string,
    rpcMethod: RpcMethodType,
    serializedArgs: Record<string, unknown>,
    statusCallback: StatusCallback | undefined,
  ) {
    const worker = await this.getWorker(sessionId)
    return worker.call(rpcMethod.name, serializedArgs, { statusCallback })
  }

  /**
   * Boot one worker and run the configuration handshake. Overridable so a test
   * can hand the pool a fake handle without a `Worker`; nothing in the app does.
   */
  async makeWorker(): Promise<WorkerHandle> {
    // one RpcClient per worker so we can do our own state-group-aware load
    // balancing across the pool
    const instance = this.options.makeWorkerInstance()
    const handle = new WebWorkerHandle(instance)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    if (isSafari) {
      // xref https://github.com/GMOD/jbrowse-components/issues/3245
      // eslint-disable-next-line no-console
      console.log(
        'console logging the webworker handle avoids the track going into an infinite loading state, this is a hacky workaround for safari',
        instance,
      )
    }

    // send the worker its boot configuration using info from the pluginManager
    return new Promise<WebWorkerHandle>((resolve, reject) => {
      const cleanup = () => {
        instance.removeEventListener('message', onMessage)
        instance.removeEventListener('error', onError)
      }
      // the pool discards this slot and re-boots on the next call, so terminate
      // the half-booted worker rather than orphaning its thread
      const fail = (error: Error) => {
        cleanup()
        handle.destroy()
        reject(error)
      }
      const onMessage = (e: MessageEvent) => {
        switch (e.data.message) {
          case 'ready': {
            cleanup()
            resolve(handle)
            break
          }
          case 'readyForConfig': {
            // The worker is waiting in receiveConfiguration(), which has no
            // timeout, and this listener's throw would escape before cleanup or
            // fail could run — so an unclonable boot configuration left both
            // sides waiting forever rather than reporting anything.
            try {
              const { plugins, windowHref, numberGrouping } = this.options
              instance.postMessage({
                message: 'config',
                config: { plugins, windowHref, numberGrouping },
              })
            } catch (e) {
              fail(
                new Error(`could not send the worker its boot configuration`, {
                  cause: e,
                }),
              )
            }
            break
          }
          case 'error': {
            fail(deserializeError(e.data.error))
            break
          }
          // No default
        }
      }
      // a worker that throws while loading its script posts no message, so
      // reject on the raw ErrorEvent too, else the boot promise hangs forever
      const onError = (e: ErrorEvent) => {
        fail(new Error(e.message || 'worker failed to load'))
      }
      instance.addEventListener('message', onMessage)
      instance.addEventListener('error', onError)
    })
  }
}
