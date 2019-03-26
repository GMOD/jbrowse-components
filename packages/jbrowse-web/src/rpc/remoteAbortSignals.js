/* ---------------- for the RPC client ----------------- */

let abortSignalCounter = 0
const abortSignalIds = new WeakMap() // map of abortsignal => numerical ID

/**
 * assign an ID to the given abort signal and return a plain object representation
 * @param {AbortSignal} signal the signal to serialize
 * @param {function} callfunc function used to call a remote method, will be called like callfunc('signalAbort', signalId)
 */
export function serializeAbortSignal(signal, callfunc) {
  if (!abortSignalIds.has(signal)) {
    abortSignalCounter += 1
    abortSignalIds.set(signal, abortSignalCounter)
    signal.addEventListener('abort', () => {
      callfunc('signalAbort', abortSignalIds.get(signal))
    })
  }
  return { abortSignalId: abortSignalIds.get(signal) }
}

/* ---------------- for the RPC server ----------------- */

/**
 * test whether a given object
 * @param {object} thing the thing to test
 * @returns {boolean} true if the thing is a remote abort signal
 */
export function isRemoteAbortSignal(thing) {
  return thing && typeof thing.abortSignalId === 'number'
}

// the server side keeps a set of surrogate abort controllers that can be
// aborted based on ID
const surrogateAbortControllers = new Map() // numerical ID => surrogate abort controller

/**
 * deserialize the result of serializeAbortSignal into an AbortSignal
 *
 * @param {RemoteAbortSignal} signal
 * @returns {AbortSignal} an abort signal that corresponds to the given ID
 */
export function deserializeAbortSignal({ abortSignalId }) {
  if (!surrogateAbortControllers.has(abortSignalId)) {
    surrogateAbortControllers.set(abortSignalId, new AbortController())
  }
  return surrogateAbortControllers.get(abortSignalId).signal
}

/**
 * fire an abort signal from a remote abort signal ID
 *
 * @param {number} abortSignalId
 */
export function remoteAbort(abortSignalId) {
  if (surrogateAbortControllers.has(abortSignalId)) {
    surrogateAbortControllers.get(abortSignalId).abort()
  }
}

export function remoteAbortRpcHandler() {
  return {
    signalAbort: remoteAbort,
  }
}
