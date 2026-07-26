import { isRpcResult } from '../util/rpc.ts'
import { serializeError } from './serializeError/index.ts'

import type { ErrorObject } from './serializeError/index.ts'

interface WorkerSelf {
  postMessage(message: unknown, transfer?: Transferable[]): void
  addEventListener(type: string, listener: (e: MessageEvent) => void): void
}

// `self` is a DedicatedWorkerGlobalScope in the worker, but the DOM lib types the
// ambient `self` as Window (whose postMessage overloads differ), so narrow it to
// the surface RpcServer uses. Absent entirely under plain node.
const workerSelf =
  typeof self === 'undefined' ? undefined : (self as unknown as WorkerSelf)

// The wrapper an RPC method returns to hand transferables to postMessage. `T`
// is the value the caller ultimately receives, so it flows out of an executor's
// return type and gets checked against the method's declared RpcRegistry
// `return` (see RpcMethodType) instead of decaying to `unknown` at the wrapper.
export interface RpcResult<T = unknown> {
  __rpcResult: true
  value: T
  transferables: Transferable[]
}

export function rpcResult<T>(
  value: T,
  transferables: Transferable[],
): RpcResult<T> {
  return { __rpcResult: true, value, transferables }
}

// rpcResult with transferables auto-derived from the result's top-level
// TypedArray fields, so a newly-added typed-array field is transferred (moved,
// zero-copy) rather than silently structurally cloned just because a
// hand-maintained buffer list wasn't extended. Use for any worker RPC whose
// result is a flat object of typed arrays (canvas/synteny/dotplot/wiggle packers).
export function rpcResultWithArrayBuffers<T extends object>(value: T) {
  const fields: unknown[] = Object.values(value)
  // A Set because several fields can be views onto one allocation (subarrays of
  // a shared buffer), and postMessage rejects a transfer list with a duplicate
  // entry outright. SharedArrayBuffer-backed views are skipped for the same
  // reason: a SAB can't be transferred, only cloned.
  const transferables = new Set<ArrayBuffer>()
  for (const field of fields) {
    if (ArrayBuffer.isView(field) && field.buffer instanceof ArrayBuffer) {
      transferables.add(field.buffer)
    }
  }
  return rpcResult(value, [...transferables])
}

type Procedure = (data: unknown) => Promise<unknown>

interface RpcMessageData {
  method: string
  uid: string
  libRpc?: true
  data: unknown
}

export default class RpcServer {
  protected methods: Record<string, Procedure>

  private self: WorkerSelf

  constructor(methods: Record<string, Procedure>) {
    if (!workerSelf) {
      throw new Error('RpcServer must be constructed in a worker global scope')
    }
    this.methods = methods
    this.self = workerSelf
    this.self.addEventListener('message', (e: MessageEvent) => {
      this.handler(e)
    })
  }

  handler(e: MessageEvent<RpcMessageData>) {
    const { libRpc, method, uid, data } = e.data
    if (!libRpc) {
      return
    }
    const methodFn = Object.hasOwn(this.methods, method)
      ? this.methods[method]
      : undefined
    if (methodFn) {
      // wrap so a synchronous throw inside methodFn still routes to .throw()
      ;(async () => methodFn(data))()
        .then(response => {
          this.reply(uid, response)
        })
        .catch((error: unknown) => {
          this.throw(uid, serializeError(error))
        })
    } else {
      this.throw(uid, `Unknown RPC method "${method}"`)
    }
  }

  // every outgoing message carries the libRpc tag so the client can tell our
  // frames apart from unrelated worker traffic
  private post(
    payload: Record<string, unknown>,
    transferables: Transferable[],
  ) {
    this.self.postMessage({ ...payload, libRpc: true }, transferables)
  }

  protected reply(uid: string, response: unknown) {
    // a renderer may return an rpcResult wrapper carrying transferables for
    // zero-copy; a plain return travels as data with nothing to transfer
    const { value, transferables } = isRpcResult(response)
      ? response
      : { value: response, transferables: [] }
    try {
      this.post({ uid, data: value }, transferables)
    } catch (e) {
      this.throw(uid, serializeError(e))
    }
  }

  protected throw(uid: string, error: ErrorObject | string) {
    this.post({ uid, error }, [])
  }

  emit(eventName: string, data: unknown, transferables?: Transferable[]) {
    this.post({ eventName, data }, transferables ?? [])
  }
}
