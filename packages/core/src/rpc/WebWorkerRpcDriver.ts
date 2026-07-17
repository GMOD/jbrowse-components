import RpcClient from './RpcClient.ts'
import WorkerPoolRpcDriver from './WorkerPoolRpcDriver.ts'
import { deserializeError } from './serializeError/index.ts'
import { nanoid } from '../util/nanoid.ts'

import type { RpcDriverConstructorArgs } from './BaseRpcDriver.ts'
import type { PluginDefinition } from '../PluginLoader.ts'
import type { RpcStatus, StatusCallback } from '../util/progress.ts'

interface WebWorkerRpcDriverConstructorArgs extends RpcDriverConstructorArgs {
  makeWorkerInstance: () => Worker
}

interface Options {
  statusCallback?: StatusCallback
  rpcDriverClassName: string
}

class WebWorkerHandle {
  private client: RpcClient

  constructor(public worker: Worker) {
    this.client = new RpcClient(worker)
    // Listen for worker errors that might not be caught by RpcClient
    this.client.on('error', error => {
      console.error('[WebWorker RPC Error]', error)
    })
  }

  destroy() {
    this.worker.terminate()
  }

  // lets the pool discard this handle once the worker throws a fatal error
  onError(callback: () => void) {
    this.client.on('error', callback)
  }

  async call(funcName: string, args: Record<string, unknown>, opts: Options) {
    const { statusCallback, rpcDriverClassName } = opts
    const channel = `message-${nanoid()}`
    // RpcClient is a generic event emitter (it also carries 'error' events), so
    // its listeners see `unknown`. This channel is dedicated to one method's
    // status emits, which the worker only ever posts as RpcStatus (see
    // wrapForRpc in rpcWorker.ts), so narrowing to RpcStatus here is sound.
    const listener = (message: unknown) => {
      statusCallback?.(message as RpcStatus)
    }
    this.client.on(channel, listener)
    try {
      const result = await this.client.call(funcName, {
        ...args,
        channel,
        rpcDriverClassName,
      })
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
    return new Promise((resolve: (w: WebWorkerHandle) => void, reject) => {
      const cleanup = () => {
        instance.removeEventListener('message', onMessage)
        instance.removeEventListener('error', onError)
      }
      const onMessage = (e: MessageEvent) => {
        switch (e.data.message) {
          case 'ready': {
            cleanup()
            resolve(handle)
            break
          }
          case 'readyForConfig': {
            instance.postMessage({
              message: 'config',
              config: this.workerBootConfiguration,
            })
            break
          }
          case 'error': {
            cleanup()
            reject(deserializeError(e.data.error))
            break
          }
          // No default
        }
      }
      // a worker that throws while loading its script posts no message, so
      // reject on the raw ErrorEvent too, else the boot promise hangs forever
      const onError = (e: ErrorEvent) => {
        cleanup()
        reject(new Error(e.message || 'worker failed to load'))
      }
      instance.addEventListener('message', onMessage)
      instance.addEventListener('error', onError)
    })
  }
}
