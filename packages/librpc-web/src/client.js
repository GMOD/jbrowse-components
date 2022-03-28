import EventEmitter from '@librpc/ee'
import { peekTransferables, uuid } from './utils.js'
import { deserializeError } from 'serialize-error'

class RpcClient extends EventEmitter {
  /**
   * Client could be connected to several workers for better CPU utilization.
   * Requests are sent to an exact worker by round robin algorithm.
   * @param {WebWorker[]} options.workers List of server workers
   */
  constructor({ workers }) {
    super()
    this.workers = [...workers]
    this.idx = 0
    this.calls = {}
    this.timeouts = {}
    this.errors = {}
    this.handler = this.handler.bind(this)
    this.catch = this.catch.bind(this)
    this.init()
  }

  /**
   * Subscribtion to web workers events
   * @protected
   */
  init() {
    this.workers.forEach(this.listen, this)
  }

  /**
   * Subsrciption to exact worker
   * @param {WebWorker} worker Server worker
   * @proteced
   */
  listen(worker) {
    worker.addEventListener('message', this.handler)
    worker.addEventListener('error', this.catch)
  }

  /**
   * Message handler
   * @param {Event}   e               Event object
   * @param {Object}  e.data          Message event data
   * @param {number}  e.data.uid      Remote call uid
   * @param {boolean} e.data.libRpc   `true` flag
   * @param {string}  [e.data.error]  Error discription
   * @param {string}  [e.data.method] Remote procedure name
   * @param {string}  [e.data.event]  Server event name
   * @param {*}       [e.data.data]   Procedure result or event data
   * @protected
   */
  handler(e) {
    const { uid, error, method, eventName, data, libRpc } = e.data

    if (!libRpc) {
      return
    } // ignore non-librpc messages

    if (error) {
      this.reject(uid, error)
    } else if (method) {
      this.resolve(uid, data)
    } else if (eventName) {
      this.emit(eventName, data)
    }
  }

  /**
   * Error handler
   * https://www.nczonline.net/blog/2009/08/25/web-workers-errors-and-debugging/
   * @param  {string}  options.message  Error message
   * @param  {number}  options.lineno   Line number
   * @param  {string}  options.filename Filename
   * @param  {boolean} options.libRpc   Error ignored if this is not true
   * @protected
   */
  catch({ message, lineno, filename, libRpc }) {
    if (libRpc) {
      this.emit('error', {
        message,
        lineno,
        filename,
      })
    }
  }

  /**
   * Handle remote procedure call error
   * @param {string} uid   Remote call uid
   * @param {strint} error Error message
   * @protected
   */
  reject(uid, error) {
    if (this.errors[uid]) {
      this.errors[uid](deserializeError(error))
      this.clear(uid)
    }
  }

  /**
   * Handle remote procedure call response
   * @param {string} uid  Remote call uid
   * @param {*}      data Response data
   * @protected
   */
  resolve(uid, data) {
    if (this.calls[uid]) {
      this.calls[uid](data)
      this.clear(uid)
    }
  }

  /**
   * Clear inner references to remote call
   * @param {string} uid Remote call uid
   * @protected
   */
  clear(uid) {
    clearTimeout(this.timeouts[uid])
    delete this.timeouts[uid]
    delete this.calls[uid]
    delete this.errors[uid]
  }

  /**
   * Remote procedure call. Only ArrayBuffers will be transferred automatically (not TypedArrays).
   * Error would be thrown, if:
   * - it happened during procedure
   * - you try to call an unexisted procedure
   * - procedure execution takes more than timeout
   * @param  {string}     method                 Remote procedure name
   * @param  {*}          data                   Request data
   * @param  {Object}     [options]              Options
   * @param  {number}     [options.timeout=2000] Wait timeout
   * @return {Promise<*>}                        Remote procedure promise
   */
  call(method, data, { timeout = 2000 } = {}) {
    const uid = uuid()
    const transferables = peekTransferables(data)
    return new Promise((resolve, reject) => {
      this.timeouts[uid] = setTimeout(
        () =>
          this.reject(
            uid,
            new Error(`Timeout exceeded for RPC method "${method}"`),
          ),
        timeout,
      )
      this.calls[uid] = resolve
      this.errors[uid] = reject
      this.workers[this.idx].postMessage(
        { method, uid, data, libRpc: true },
        transferables,
      )
      this.idx = ++this.idx % this.workers.length // round robin
    })
  }
}

export default RpcClient
