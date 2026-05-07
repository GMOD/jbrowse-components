import { deserializeError } from './serializeError/index.ts'

type Listener = (arg: unknown) => void

interface RpcMessageData {
  uid: string
  libRpc?: true
  error?: string
  method?: string
  eventName?: string
  data: unknown
}

interface PendingCall {
  resolve: (data: unknown) => void
  reject: (error: Error) => void
}

export default class RpcClient {
  worker: Worker
  pending = new Map<string, PendingCall>()
  private events = new Map<string, Listener[]>()
  private counter = 0

  constructor(worker: Worker) {
    this.worker = worker
    this.worker.addEventListener('message', e => {
      this.handler(e)
    })
    this.worker.addEventListener('error', e => {
      this.catch(e)
    })
  }

  on(event: string, listener: Listener) {
    let listeners = this.events.get(event)
    if (!listeners) {
      this.events.set(event, (listeners = []))
    }
    listeners.push(listener)
    return this
  }

  off(event: string, listener: Listener) {
    const listeners = this.events.get(event)
    if (listeners) {
      const idx = listeners.indexOf(listener)
      if (idx !== -1) {
        listeners.splice(idx, 1)
      }
    }
    return this
  }

  emit(event: string, data: unknown) {
    const listeners = this.events.get(event)
    if (listeners) {
      for (const listener of listeners) {
        listener(data)
      }
    }
    return this
  }

  protected handler(e: MessageEvent<RpcMessageData>) {
    const { uid, error, method, eventName, data, libRpc } = e.data
    if (!libRpc) {
      return
    }
    if (error) {
      this.reject(uid, error)
    } else if (method) {
      this.resolve(uid, data)
    } else if (eventName) {
      this.emit(eventName, data)
    }
  }

  protected catch(e: ErrorEvent) {
    const error = new Error(e.message)
    for (const { reject } of this.pending.values()) {
      reject(error)
    }
    this.pending.clear()
    this.emit('error', {
      message: e.message,
      lineno: e.lineno,
      filename: e.filename,
    })
  }

  protected reject(uid: string, error: string | Error) {
    const p = this.pending.get(uid)
    if (p) {
      p.reject(deserializeError(error))
      this.pending.delete(uid)
    }
  }

  protected resolve(uid: string, data: unknown) {
    const p = this.pending.get(uid)
    if (p) {
      p.resolve(data)
      this.pending.delete(uid)
    }
  }

  call(
    method: string,
    data: unknown,
    { transferables = [] }: { transferables?: Transferable[] } = {},
  ) {
    const uid = String(++this.counter)
    return new Promise((resolve, reject) => {
      this.pending.set(uid, { resolve, reject })
      this.worker.postMessage(
        { method, uid, data, libRpc: true },
        transferables,
      )
    })
  }
}
