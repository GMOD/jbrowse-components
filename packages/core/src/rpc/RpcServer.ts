import { serializeError } from './serializeError/index.ts'

import type { ErrorObject } from './serializeError/index.ts'

interface WorkerSelf {
  postMessage(message: unknown, transfer?: Transferable[]): void
  addEventListener(type: string, listener: (e: MessageEvent) => void): void
}

const workerSelf = self as unknown as WorkerSelf

export interface RpcResult {
  __rpcResult: true
  value: unknown
  transferables: Transferable[]
}

export function rpcResult(value: unknown, transferables: Transferable[]) {
  return { __rpcResult: true, value, transferables } as RpcResult
}

function isRpcResult(value: unknown): value is RpcResult {
  return typeof value === 'object' && value !== null && '__rpcResult' in value
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
    workerSelf.addEventListener('message', (e: MessageEvent) => {
      this.handler(e)
    })
  }

  protected handler(e: MessageEvent<RpcMessageData>) {
    const { libRpc, method, uid, data } = e.data
    if (!libRpc) {
      return
    }
    const methodFn = this.methods[method]
    if (methodFn) {
      Promise.resolve(data)
        .then(methodFn)
        .then(
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

  protected reply(uid: string, method: string, response: unknown) {
    try {
      if (isRpcResult(response)) {
        const { value, transferables } = response
        workerSelf.postMessage(
          { uid, method, data: value, libRpc: true },
          transferables,
        )
      } else {
        workerSelf.postMessage(
          { uid, method, data: response, libRpc: true },
          [] as Transferable[],
        )
      }
    } catch (e) {
      this.throw(uid, serializeError(e))
    }
  }

  protected throw(uid: string, error: ErrorObject | string) {
    workerSelf.postMessage({ uid, error, libRpc: true })
  }

  emit(eventName: string, data: unknown, transferables?: Transferable[]) {
    workerSelf.postMessage(
      { eventName, data, libRpc: true },
      transferables ?? ([] as Transferable[]),
    )
  }
}
