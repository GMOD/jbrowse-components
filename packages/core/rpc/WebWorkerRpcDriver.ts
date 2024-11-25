import Rpc from 'librpc-web-mod'
import { deserializeError } from 'serialize-error'

// locals
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

class WebWorkerHandle extends Rpc.Client {
  destroy(): void {
    this.workers[0]!.terminate()
  }

  async call(funcName: string, args: Record<string, unknown>, opts: Options) {
    const { statusCallback, rpcDriverClassName } = opts
    const channel = `message-${nanoid()}`
    const listener = (message: unknown) => {
      statusCallback?.(message)
    }
    this.on(channel, listener)
    const result = await super.call(
      funcName,
      { ...args, channel, rpcDriverClassName },
      opts,
    )
    this.off(channel, listener)
    return result
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

    // @ts-ignore this is used to avoid warning in jbrowse-web startup
    // (because this file is referred to via src, declare.d.ts file is in
    // e.g. products/jbrowse-web)
    const worker = new WebWorkerHandle({ workers: [instance] })
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
            resolve(worker)
            worker.workers[0]!.removeEventListener('message', listener)
            break
          }
          case 'readyForConfig': {
            worker.workers[0]!.postMessage({
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
      worker.workers[0]!.addEventListener('message', listener)
    })
  }
}
