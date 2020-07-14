import Rpc from '@librpc/web'
import BaseRpcDriver from './BaseRpcDriver'
import PluginManager from '../PluginManager'
import { PluginDefinition } from '../PluginLoader'

interface WebpackWorker {
  new (): Worker
  prototype: Worker
}

class WebWorkerHandle extends Rpc.Client {
  destroy(): void {
    this.workers[0].terminate()
  }
}

export default class WebWorkerRpcDriver extends BaseRpcDriver {
  WorkerClass: WebpackWorker

  workerBootConfiguration: { plugins: PluginDefinition[] }

  constructor(
    { WorkerClass }: { WorkerClass: WebpackWorker },
    workerBootConfiguration: { plugins: PluginDefinition[] },
  ) {
    super()
    this.WorkerClass = WorkerClass
    this.workerBootConfiguration = workerBootConfiguration
  }

  makeWorker(pluginManager: PluginManager) {
    // note that we are making a Rpc.Client connection with a worker pool of one for each worker,
    // because we want to do our own state-group-aware load balancing rather than using librpc's
    // builtin round-robin
    const worker = new WebWorkerHandle({ workers: [new this.WorkerClass()] })
    // send the worker its boot configuration using info from the pluginManager
    worker.workers[0].postMessage(this.workerBootConfiguration)
    return worker
  }
}
