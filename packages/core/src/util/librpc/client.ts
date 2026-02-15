import EventEmitter from './ee.ts'
import { deserializeError } from './serializeError.ts'

interface RpcMessageData {
  uid: string
  libRpc?: true
  error?: string
  method?: string
  eventName?: string
  data: unknown
  sentAt?: number
}

let counter = 0

export default class RpcClient extends EventEmitter {
  protected calls = new Map<string, (data: unknown) => void>()
  protected errors = new Map<string, (error: Error) => void>()
  protected callTimestamps = new Map<
    string,
    { method: string; sentAt: number }
  >()

  constructor(public worker: Worker) {
    super()
    this.worker.addEventListener(
      'message',
      (e: MessageEvent<RpcMessageData>) => {
        this.handler(e)
      },
    )
    this.worker.addEventListener('error', (e: ErrorEvent) => {
      this.catch(e)
    })
  }

  protected handler(e: MessageEvent<RpcMessageData>) {
    const handlerStart = performance.now()
    const { uid, error, method, eventName, data, libRpc, sentAt } = e.data
    if (!libRpc) {
      return
    }

    if (sentAt) {
      const transferTime = handlerStart - sentAt
      const callInfo = this.callTimestamps.get(uid)
      if (callInfo) {
        const roundTrip = handlerStart - callInfo.sentAt
        // console.log(
        //   `[librpc client] ${callInfo.method} uid=${uid}: ` +
        //     `workerToMain=${transferTime.toFixed(1)}ms, ` +
        //     `roundTrip=${roundTrip.toFixed(1)}ms`,
        // )
      } else {
        // console.log(
        //   `[librpc client] uid=${uid}: ` +
        //     `workerToMain=${transferTime.toFixed(1)}ms`,
        // )
      }
    }

    if (error) {
      this.reject(uid, error)
    } else if (method) {
      this.resolve(uid, data)
    } else if (eventName) {
      this.emit(eventName, data)
    }

    const handlerEnd = performance.now()
    // console.log(
    //   `[librpc client] handler body uid=${uid}: ${(handlerEnd - handlerStart).toFixed(1)}ms`,
    // )
  }

  protected catch(e: ErrorEvent) {
    this.emit('error', {
      message: e.message,
      lineno: e.lineno,
      filename: e.filename,
    })
  }

  protected reject(uid: string, error: string | Error) {
    const errorFn = this.errors.get(uid)
    if (errorFn) {
      errorFn(deserializeError(error))
      this.clear(uid)
    }
  }

  protected resolve(uid: string, data: unknown) {
    const callFn = this.calls.get(uid)
    if (callFn) {
      callFn(data)
      this.clear(uid)
    }
  }

  protected clear(uid: string) {
    this.calls.delete(uid)
    this.errors.delete(uid)
    this.callTimestamps.delete(uid)
  }

  call(
    method: string,
    data: unknown,
    { transferables = [] }: { transferables?: Transferable[] } = {},
  ) {
    const uid = String(++counter)
    const sentAt = performance.now()
    return new Promise((resolve, reject) => {
      this.calls.set(uid, resolve)
      this.errors.set(uid, reject)
      this.callTimestamps.set(uid, { method, sentAt })
      this.worker.postMessage(
        { method, uid, data, libRpc: true, sentAt },
        transferables,
      )
    })
  }
}
