import { RpcClient } from 'librpc-web-mod'
import { deserializeError } from 'serialize-error'

import BaseRpcDriver from './BaseRpcDriver'
import { nanoid } from '../util/nanoid'

import type { RpcDriverConstructorArgs } from './BaseRpcDriver'
import type { PluginDefinition } from '../PluginLoader'

interface WebWorkerRpcDriverConstructorArgs extends RpcDriverConstructorArgs {
  makeWorkerInstance: () => Worker
}

interface Options {
  statusCallback?: (arg0: unknown) => void
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

  async call(funcName: string, args: Record<string, unknown>, opts: Options) {
    const { statusCallback, rpcDriverClassName } = opts
    const channel = `message-${nanoid()}`
    const listener = (message: unknown) => {
      statusCallback?.(message)
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

export default class WebWorkerRpcDriver extends BaseRpcDriver {
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
    // note that we are making a Rpc.Client connection with a worker pool of
    // one for each worker, because we want to do our own state-group-aware
    // load balancing rather than using librpc's builtin round-robin
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
      const listener = (e: MessageEvent) => {
        switch (e.data.message) {
          case 'ready': {
            resolve(handle)
            instance.removeEventListener('message', listener)
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
            reject(deserializeError(e.data.error))
            break
          }
          // No default
        }
      }
      instance.addEventListener('message', listener)
    })
  }
}
