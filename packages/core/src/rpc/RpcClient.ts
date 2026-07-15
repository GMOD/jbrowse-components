import { deserializeError } from './serializeError/index.ts'

import type { ErrorObject } from './serializeError/index.ts'

type Listener = (arg: unknown) => void

interface RpcMessageData {
  uid: string
  libRpc?: true
  // errors arrive as a serialized ErrorObject, or a bare string for
  // framework-level failures (e.g. `Unknown RPC method "..."`)
  error?: string | ErrorObject
  eventName?: string
  // absent on error frames; carried by replies and events
  data?: unknown
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
    const listeners = this.events.get(event)
    if (listeners) {
      listeners.push(listener)
    } else {
      this.events.set(event, [listener])
    }
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
    const { uid, error, eventName, data, libRpc } = e.data
    if (!libRpc) {
      return
    }
    // three frame kinds share the channel: an error (rejects the call), a
    // named event (status side-channel), and — the default — a call reply
    if (error) {
      this.reject(uid, error)
    } else if (eventName) {
      this.emit(eventName, data)
    } else {
      this.resolve(uid, data)
    }
  }

  protected catch(e: ErrorEvent) {
    const error = new Error(e.message)
    // snapshot before clearing so a synchronous reject handler that schedules
    // a new call() can't have its entry dropped by the clear()
    const snapshot = [...this.pending.values()]
    this.pending.clear()
    for (const { reject } of snapshot) {
      reject(error)
    }
    this.emit('error', {
      message: e.message,
      lineno: e.lineno,
      filename: e.filename,
    })
  }

  protected reject(uid: string, error: string | ErrorObject) {
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
