import RpcClient from './RpcClient.ts'
import WorkerPoolRpcDriver from './WorkerPoolRpcDriver.ts'
import { deserializeError } from './serializeError/index.ts'

import type { PluginDefinition } from '../pluginDefinitions.ts'
import type { RpcStatus, StatusCallback } from '../util/progress.ts'
import type { RpcDriverConstructorArgs } from './BaseRpcDriver.ts'

interface WebWorkerRpcDriverConstructorArgs extends RpcDriverConstructorArgs {
  makeWorkerInstance: () => Worker
}

interface Options {
  statusCallback?: StatusCallback
}

class WebWorkerHandle {
  private client: RpcClient

  // a counter, not a nanoid: the listener map a channel keys into is this
  // handle's own client, so that is the only scope uniqueness is needed in, and
  // the nanoid was a crypto.getRandomValues per reporting call
  private channelCount = 0

  constructor(public worker: Worker) {
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
    opts: Options = {},
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

export default class WebWorkerRpcDriver extends WorkerPoolRpcDriver {
  name = 'WebWorkerRpcDriver'

  makeWorkerInstance: () => Worker

  constructor(
    args: WebWorkerRpcDriverConstructorArgs,
    public workerBootConfiguration: {
      plugins: PluginDefinition[]
      windowHref: string
      numberGrouping: boolean
    },
  ) {
    super(args)
    this.makeWorkerInstance = args.makeWorkerInstance
  }

  async makeWorker() {
    // one RpcClient per worker so we can do our own state-group-aware load
    // balancing across the pool (see WorkerPoolRpcDriver)
    const instance = this.makeWorkerInstance()
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
              instance.postMessage({
                message: 'config',
                config: this.workerBootConfiguration,
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
