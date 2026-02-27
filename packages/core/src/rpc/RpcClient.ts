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

export default class RpcClient {
  worker: Worker
  protected calls = new Map<string, (data: unknown) => void>()
  protected errors = new Map<string, (error: Error) => void>()
  private events: Record<string, Listener[]> = {}
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
    let listeners = this.events[event]
    if (!listeners) {
      listeners = []
      this.events[event] = listeners
    }
    listeners.push(listener)
    return this
  }

  off(event: string, listener: Listener) {
    const listeners = this.events[event]
    if (listeners) {
      const idx = listeners.indexOf(listener)
      if (idx !== -1) {
        listeners.splice(idx, 1)
      }
    }
    return this
  }

  emit(event: string, data: unknown) {
    const listeners = this.events[event]
    if (listeners) {
      for (const listener of listeners) {
        listener(data)
      }
    }
    return this
  }

  private _eventMessageCount = 0
  private _eventMessageTimer: ReturnType<typeof setTimeout> | undefined

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
      this._eventMessageCount++
      if (!this._eventMessageTimer) {
        this._eventMessageTimer = setTimeout(() => {
          console.log(
            `[RpcClient] received ${this._eventMessageCount} event messages in last batch`,
          )
          this._eventMessageCount = 0
          this._eventMessageTimer = undefined
        }, 1000)
      }
      this.emit(eventName, data)
    }
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
  }

  call(
    method: string,
    data: unknown,
    { transferables = [] }: { transferables?: Transferable[] } = {},
  ) {
    const uid = String(++this.counter)
    return new Promise((resolve, reject) => {
      this.calls.set(uid, resolve)
      this.errors.set(uid, reject)
      this.worker.postMessage(
        { method, uid, data, libRpc: true },
        transferables,
      )
    })
  }
}
