/* ---------------- for the RPC client ----------------- */

let abortSignalCounter = 0
export type RemoteAbortSignal = { abortSignalId: number }
const abortSignalIds: WeakMap<AbortSignal, number> = new WeakMap() // map of abortsignal => numerical ID

/**
 * assign an ID to the given abort signal and return a plain object representation
 * @param signal - the signal to serialize
 * @param callfunc - function used to call
 *  a remote method, will be called like callfunc('signalAbort', signalId)
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

/* ---------------- for the RPC server ----------------- */

/**
 * test whether a given object
 * @param thing - the thing to test
 * @returns true if the thing is a remote abort signal
 */
export function isRemoteAbortSignal(
  thing: unknown,
): thing is RemoteAbortSignal {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'abortSignalId' in thing &&
    // @ts-ignore
    typeof thing.abortSignalId === 'number'
  )
}

// the server side keeps a set of surrogate abort controllers that can be
// aborted based on ID
const surrogateAbortControllers: Map<number, AbortController> = new Map() // numerical ID => surrogate abort controller

/**
 * deserialize the result of serializeAbortSignal into an AbortSignal
 *
 * @param signal -
 * @returns an abort signal that corresponds to the given ID
 */
export function deserializeAbortSignal({
  abortSignalId,
}: RemoteAbortSignal): AbortSignal {
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
