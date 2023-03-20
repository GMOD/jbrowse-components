import * as Comlink from 'comlink'

// locals
import BaseRpcDriver, { RpcDriverConstructorArgs } from './BaseRpcDriver'
import { PluginDefinition } from '../PluginLoader'

interface WebWorkerRpcDriverConstructorArgs extends RpcDriverConstructorArgs {
  makeWorkerInstance: () => Worker
}

interface Options {
  statusCallback?: (arg0: string) => void
  rpcDriverClassName: string
}

class WebWorkerHandle {
  worker: Comlink.Remote<unknown>
  constructor(worker: Worker) {
    this.worker = Comlink.wrap(worker)
  }
  destroy() {}

  async call(funcName: string, args: Record<string, unknown>, opts: Options) {
    const { statusCallback } = opts
    // @ts-expect-error
    return this.worker.call(
      funcName,
      args,
      statusCallback ? Comlink.proxy(statusCallback) : undefined,
    )
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
    const instance = this.makeWorkerInstance()
    const comlink = new WebWorkerHandle(instance)

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    if (isSafari) {
      // xref https://github.com/GMOD/jbrowse-components/issues/3245
      // possibly related to https://github.com/GoogleChromeLabs/comlink/issues/600#issuecomment-1387011970
      // eslint-disable-next-line no-console
      console.log(
        'console logging the webworker handle avoids the track going into an infinite loading state, this is a hacky workaround for safari',
        instance,
      )
    }

    // @ts-expect-error
    await comlink.worker.conf(this.workerBootConfiguration)
    return comlink
  }
}
