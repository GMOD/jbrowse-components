import Rpc from '@librpc/web'
import BaseRpcDriver from './BaseRpcDriver'

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
  makeWorker: () => WebWorkerHandle

  constructor({ WorkerClass }: { WorkerClass: WebpackWorker }) {
    super()
    // note that we are making a Rpc.Client connection with a worker pool of one for each worker,
    // because we want to do our own state-group-aware load balancing rather than using librpc's
    // builtin round-robin
    this.makeWorker = (): WebWorkerHandle => {
      return new WebWorkerHandle({ workers: [new WorkerClass()] })
    }
  }
}
