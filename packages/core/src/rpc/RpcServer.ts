import { serializeError } from './serializeError/index.ts'
import { isRpcResult } from '../util/rpc.ts'

import type { ErrorObject } from './serializeError/index.ts'

interface WorkerSelf {
  postMessage(message: unknown, transfer?: Transferable[]): void
  addEventListener(type: string, listener: (e: MessageEvent) => void): void
}

const workerSelf =
  typeof self !== 'undefined' ? (self as unknown as WorkerSelf) : null

export interface RpcResult {
  __rpcResult: true
  value: unknown
  transferables: Transferable[]
}

export function rpcResult(value: unknown, transferables: Transferable[]) {
  return { __rpcResult: true, value, transferables } as RpcResult
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

  constructor(methods: Record<string, Procedure>) {
    this.methods = methods
    workerSelf!.addEventListener('message', (e: MessageEvent) => {
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
      ;(async () => methodFn(data))().then(
        response => {
          this.reply(uid, method, response)
        },
        (error: unknown) => {
          this.throw(uid, serializeError(error))
        },
      )
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
    workerSelf!.postMessage({ ...payload, libRpc: true }, transferables)
  }

  protected reply(uid: string, method: string, response: unknown) {
    // a renderer may return an rpcResult wrapper carrying transferables for
    // zero-copy; a plain return travels as data with nothing to transfer
    const { value, transferables } = isRpcResult(response)
      ? response
      : { value: response, transferables: [] }
    try {
      this.post({ uid, method, data: value }, transferables)
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
