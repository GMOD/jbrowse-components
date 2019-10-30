/* ---------------- for the RPC client ----------------- */

let abortSignalCounter = 0
const abortSignalIds: WeakMap<AbortSignal, number> = new WeakMap() // map of abortsignal => numerical ID

/**
 * assign an ID to the given abort signal and return a plain object representation
 * @param {AbortSignal} signal the signal to serialize
 * @param {function} callfunc function used to call
 *  a remote method, will be called like callfunc('signalAbort', signalId)
 */
export function serializeAbortSignal(
  signal: AbortSignal,
  callfunc: Function,
): { abortSignalId: number } {
  let abortSignalId = abortSignalIds.get(signal)
  if (!abortSignalId) {
    abortSignalCounter += 1
    abortSignalIds.set(signal, abortSignalCounter)
    abortSignalId = abortSignalCounter
    signal.addEventListener('abort', () => {
      callfunc('signalAbort', abortSignalIds.get(signal))
    })
  }
  return { abortSignalId }
}

/* ---------------- for the RPC server ----------------- */

/**
 * test whether a given object
 * @param {object} thing the thing to test
 * @returns {boolean} true if the thing is a remote abort signal
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isRemoteAbortSignal(thing: Record<string, any>): boolean {
  return thing && typeof thing.abortSignalId === 'number'
}

// the server side keeps a set of surrogate abort controllers that can be
// aborted based on ID
const surrogateAbortControllers: Map<number, AbortController> = new Map() // numerical ID => surrogate abort controller

/**
 * deserialize the result of serializeAbortSignal into an AbortSignal
 *
 * @param {RemoteAbortSignal} signal
 * @returns {AbortSignal} an abort signal that corresponds to the given ID
 */
export function deserializeAbortSignal({
  abortSignalId,
}: {
  abortSignalId: number
}): AbortSignal {
  let surrogateAbortController = surrogateAbortControllers.get(abortSignalId)
  if (!surrogateAbortController) {
    surrogateAbortController = new AbortController()
    surrogateAbortControllers.set(abortSignalId, surrogateAbortController)
  }
  return surrogateAbortController.signal
}

/**
 * fire an abort signal from a remote abort signal ID
 *
 * @param {number} abortSignalId
 */
export function remoteAbort(abortSignalId: number): void {
  const surrogateAbortController = surrogateAbortControllers.get(abortSignalId)
  if (surrogateAbortController) surrogateAbortController.abort()
}

export function remoteAbortRpcHandler(): { signalAbort: Function } {
  return {
    signalAbort: remoteAbort,
  }
}
