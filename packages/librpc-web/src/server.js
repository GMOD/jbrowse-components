/* eslint-env serviceworker */
import { peekTransferables } from './utils.js'
import { serializeError } from 'serialize-error'

/**
 * @callback Procedure
 * @param  {*}           data Any data
 * @return {(Promise|*)}
 */

class RpcServer {
  /**
   * Every passed method becomes remote procedure.
   * It can return Promise if it is needed.
   * Only ArrayBuffers will be transferred automatically (not TypedArrays).
   * Errors thrown by procedures would be handled by server.
   * @param {Object.<string, Procedure>} methods Dictionary of remote procedures
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
  constructor(methods) {
    this.methods = methods
    this.listen()
  }

  /**
   * Subscribtion to "message" events
   * @protected
   */
  listen() {
    global.self.addEventListener('message', this.handler.bind(this))
  }

  /**
   * Handle "message" events, invoke remote procedure if it possible
   * @param {Event}   e             Message event object
   * @param {Object}  e.data        Event data
   * @param {string}  e.data.method Procedure name
   * @param {number}  e.data.uid    Unique id of rpc call
   * @param {boolean} e.data.libRpc True/false flag of whether the message is handled by this library
   * @param {*}       e.data.data   Procedure params
   * @protected
   */
  handler(e) {
    const { libRpc, method, uid, data } = e.data

    if (!libRpc) {
      return
    } // ignore non-librpc messages

    if (this.methods[method]) {
      Promise.resolve(data)
        .then(this.methods[method])
        .then(
          data => this.reply(uid, method, data),
          error => this.throw(uid, serializeError(error)),
        )
    } else {
      this.throw(uid, `Unknown RPC method "${method}"`)
    }
  }

  /**
   * Reply to remote call
   * @param {number} uid    Unique id of rpc call
   * @param {string} method Procedure name
   * @param {*}      data   Call result, could be any data
   * @protected
   */
  reply(uid, method, data) {
    const transferables = peekTransferables(data)
    global.self.postMessage({ uid, method, data, libRpc: true }, transferables)
  }

  /**
   * Throw error
   * @param {number} uid   Unique id of rpc call
   * @param {string} error Error description
   * @protected
   */
  throw(uid, error) {
    global.self.postMessage({ uid, error, libRpc: true })
  }

  /**
   * Trigger server event
   * Only ArrayBuffers will be transferred automatically (not TypedArrays).
   * @param {string} eventName Event name
   * @param {*}      data      Any data
   * @example
   *
   * setInterval(() => {
   *   server.emit('update', Date.now())
   * }, 50)
   */
  emit(eventName, data) {
    const transferables = peekTransferables(data)

    global.self.postMessage({ eventName, data, libRpc: true }, transferables)
  }
}

export default RpcServer
