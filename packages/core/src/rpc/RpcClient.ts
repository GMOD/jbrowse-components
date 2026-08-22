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
    // A frame this realm could not DESERIALIZE, as opposed to `error`, which is
    // the worker's script throwing. It carries no uid, so the reply it lost
    // cannot be identified and settling everything is the only move — the same
    // one `catch` makes, and better than a display spinning on a promise that
    // can never settle. The worker itself is left alone: it is still healthy,
    // and a plugin's own non-libRpc traffic on it can be what failed.
    this.worker.addEventListener('messageerror', () => {
      this.rejectAllPending(
        new Error('an RPC worker message could not be deserialized'),
      )
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
      // drop the emptied key, not just the listener: every RPC call mints its
      // own `message-<nanoid>` status channel (WebWorkerHandle.call), so a
      // retained empty array is one dead Map entry per call for the life of the
      // page — six figures of them in a long session
      if (listeners.length === 0) {
        this.events.delete(event)
      }
    }
    return this
  }

  emit(event: string, data: unknown) {
    const listeners = this.events.get(event)
    if (listeners) {
      // over a copy: a listener that removes itself splices the live array, and
      // a `for...of` over that skips whichever listener moved down into the
      // index it just read
      for (const listener of [...listeners]) {
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
    // named event (status side-channel), and — the default — a call reply.
    //
    // Which KIND the frame is, never whether its payload looks useful. A truthy
    // test read `error: ''` as a reply and resolved the call with `undefined`,
    // and an empty message is exactly what `RpcServer.throw`'s last-resort
    // fallback can produce — so the guard against an unsettleable call turned
    // one class of failure into a wrong value instead. `resolve(uid, undefined)`
    // then reaches `deserializeReturn` and the caller reads fields off nothing,
    // blaming its own display.
    if (error !== undefined) {
      this.reject(uid, error)
    } else if (eventName) {
      this.emit(eventName, data)
    } else {
      this.resolve(uid, data)
    }
  }

  // terminating a worker settles nothing on its own: a pending call's reply can
  // never arrive, so reject it here instead of leaving the caller's promise (and
  // everything its continuation holds) unsettled forever
  destroy() {
    this.rejectAllPending(new Error('RPC worker was terminated'))
    this.events.clear()
  }

  private rejectAllPending(error: Error) {
    // snapshot before clearing so a synchronous reject handler that schedules
    // a new call() can't have its entry dropped by the clear()
    const snapshot = [...this.pending.values()]
    this.pending.clear()
    for (const { reject } of snapshot) {
      reject(error)
    }
  }

  protected catch(e: ErrorEvent) {
    this.rejectAllPending(new Error(e.message))
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

  /**
   * Tell this worker that a stop token has been stopped, so the calls running
   * there see it at their next await boundary and drop their in-flight reads.
   * Fire-and-forget: it settles no pending call, and a worker holding nothing
   * under that id ignores it.
   */
  notifyStopToken(id: string) {
    this.worker.postMessage({ stopToken: id, libRpc: true })
  }

  // No transfer list: transferables flow only worker → main, in a reply's
  // rpcResult wrapper. Transferring an argument would neuter the main thread's
  // own buffer — this took an option for one and nothing ever passed it.
  call(method: string, data: unknown) {
    const uid = String(++this.counter)
    return new Promise((resolve, reject) => {
      this.pending.set(uid, { resolve, reject })
      try {
        this.worker.postMessage({ method, uid, data, libRpc: true }, [])
      } catch (e) {
        // a non-cloneable payload throws here, which rejects this promise; drop
        // the entry that is now waiting on a reply the worker never received
        this.pending.delete(uid)
        throw e
      }
    })
  }
}
