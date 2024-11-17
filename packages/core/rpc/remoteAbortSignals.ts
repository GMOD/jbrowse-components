/* ---------------- for the RPC client ----------------- */

let abortSignalCounter = 0

export interface RemoteAbortSignal {
  abortSignalId: number
}

// map of AbortSignal => numerical ID
const abortSignalIds = new WeakMap<AbortSignal, number>()

/**
 * assign an ID to the given abort signal and return a plain object
 * representation
 *
 * @param signal - the signal to serialize
 * @param callfunc - function used to call a remote method, will be called like
 * callfunc('signalAbort', signalId)
 */
export function serializeAbortSignal(
  signal: AbortSignal,
  callfunc: (name: string, abortSignalId: number) => void,
): RemoteAbortSignal {
  let abortSignalId = abortSignalIds.get(signal)
  if (!abortSignalId) {
    abortSignalCounter += 1
    abortSignalIds.set(signal, abortSignalCounter)
    abortSignalId = abortSignalCounter
    signal.addEventListener('abort', () => {
      const signalId = abortSignalIds.get(signal)
      if (signalId !== undefined) {
        callfunc('signalAbort', signalId)
      }
    })
  }
  return { abortSignalId }
}

/**
 * test whether a given object
 * @param thing - the thing to test
 * @returns true if the thing is a remote abort signal
 */
export function isRemoteAbortSignal(t: unknown): t is RemoteAbortSignal {
  return (
    typeof t === 'object' &&
    t !== null &&
    'abortSignalId' in t &&
    typeof t.abortSignalId === 'number'
  )
}

// the server side keeps a set of surrogate abort controllers that can be
// aborted based on ID
// numerical ID => surrogate abort controller
const surrogateAbortControllers = new Map<number, AbortController>()

/**
 * deserialize the result of serializeAbortSignal into an AbortSignal
 *
 * @param signal -
 * @returns an abort signal that corresponds to the given ID
 */
export function deserializeAbortSignal({ abortSignalId }: RemoteAbortSignal) {
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
 * @param abortSignalId -
 */
export function remoteAbort(props: { signalId: number }) {
  const { signalId: abortSignalId } = props
  const surrogateAbortController = surrogateAbortControllers.get(abortSignalId)

  if (surrogateAbortController) {
    surrogateAbortController.abort()
  }
}

export function remoteAbortRpcHandler() {
  return {
    signalAbort: remoteAbort,
  }
}
