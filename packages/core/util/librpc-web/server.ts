/* eslint-env serviceworker */
import { serializeError } from 'serialize-error'

import { peekTransferables } from './utils'

import type { ErrorObject } from 'serialize-error'

type Procedure = (data: unknown) => Promise<unknown>

/**
 * @callback Procedure
 * @param  {*}           data Any data
 * @return {(Promise|*)}
 */

interface RpcEvent {
  /** Event data */
  data: {
    /** Procedure name */
    method: string
    /** Unique id of rpc call */
    uid: string
    /** True/false flag of whether the message is handled by this library */
    libRpc: true
    /** Procedure params */
    data: unknown
  }
}

export default class RpcServer {
  protected methods: Record<string, Procedure>

  /**
   * Every passed method becomes remote procedure.
   * It can return Promise if it is needed.
   * Only ArrayBuffers will be transferred automatically (not TypedArrays).
   * Errors thrown by procedures would be handled by server.
   * @param methods - Dictionary of remote procedures
   * @example
   *
   * var server = new RpcServer({
   *   add ({ x, y }) { return x + y },
   *   sub ({ x, y }) { return x - y },
   *   mul ({ x, y }) { return x * y },
   *   div ({ x, y }) { return x / y },
   *   pow ({ x, y }) { return x ** y }
   * })
   */
  constructor(methods: Record<string, Procedure>) {
    this.methods = methods
    this.listen()
  }

  /**
   * Subscribtion to "message" events
   */
  protected listen() {
    self.addEventListener('message', this.handler.bind(this))
  }

  /**
   * Handle "message" events, invoke remote procedure if it possible
   * @param e - Message event object
   */
  protected handler(e: RpcEvent) {
    const { libRpc, method, uid, data } = e.data

    if (!libRpc) {
      return
    } // ignore non-librpc messages

    if (this.methods[method]) {
      Promise.resolve(data)
        .then(this.methods[method])
        .then(
          data => {
            this.reply(uid, method, data)
          },
          (error: unknown) => {
            this.throw(uid, serializeError(error))
          },
        )
    } else {
      this.throw(uid, `Unknown RPC method "${method}"`)
    }
  }

  /**
   * Reply to remote call
   * @param uid - Unique id of rpc call
   * @param method - Procedure name
   * @param data - Call result, could be any data
   */
  protected reply(uid: string, method: string, data: unknown) {
    try {
      const transferables = peekTransferables(data)

      // @ts-expect-error
      self.postMessage({ uid, method, data, libRpc: true }, transferables)
    } catch (e) {
      this.throw(uid, serializeError(e))
    }
  }

  /**
   * Throw error
   * @param uid - Unique id of rpc call
   * @param error - Error description
   */
  protected throw(uid: string, error: ErrorObject | string) {
    self.postMessage({ uid, error, libRpc: true })
  }

  /**
   * Trigger server event
   * Only ArrayBuffers will be transferred automatically (not TypedArrays).
   * @param eventName - Event name
   * @param data - Any data
   * @example
   *
   * setInterval(() => {
   *   server.emit('update', Date.now())
   * }, 50)
   */
  emit(eventName: string, data: unknown) {
    const transferables = peekTransferables(data)

    // @ts-expect-error
    self.postMessage({ eventName, data, libRpc: true }, transferables)
  }
}
