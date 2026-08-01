import { Observable } from 'rxjs'

import { stopTokenSignal } from './stopToken.ts'

import type { StopToken } from './stopToken.ts'
import type { Observer } from 'rxjs'

/**
 * Wrapper for rxjs Observable.create with improved error handling and aborting
 * support.
 *
 * A `stopToken` errors the subscriber with an abort error the moment the token
 * is stopped, rather than waiting for `func` to finish work whose result is
 * already discarded. The fetch paths filter abort errors out (`isAbortException`)
 * so a cancel does not surface as a track error. It cannot interrupt `func`
 * itself — a body doing long synchronous work still needs its own
 * `checkStopToken` ticks — but it does stop delivery downstream.
 *
 * @param func - observer function, could be async
 */
export function ObservableCreate<T>(
  func: (arg: Observer<T>) => void | Promise<void>,
  stopToken?: StopToken,
): Observable<T> {
  return new Observable((observer: Observer<T>) => {
    const { signal, dispose } = stopTokenSignal(stopToken)
    const stop = () => {
      observer.error(signal.reason)
    }
    if (signal.aborted) {
      // stopped before subscribe: no 'abort' event is coming
      stop()
    } else {
      signal.addEventListener('abort', stop)
      try {
        const ret = func(observer)
        if (ret?.catch) {
          ret.catch((error: unknown) => {
            observer.error(error)
          })
        }
      } catch (error) {
        observer.error(error)
      }
    }
    return () => {
      signal.removeEventListener('abort', stop)
      dispose()
    }
  })
}
