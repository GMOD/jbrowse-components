import { Observable } from 'rxjs'

import { stopTokenSignal } from './stopToken.ts'

import type { StopToken } from './stopToken.ts'
import type { Observer, Subscription } from 'rxjs'

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

/**
 * Subscribe to an observable and resolve when it completes, running `onNext` per
 * item as it arrives — the streaming shape for parsing items out of a feature
 * stream rather than collecting them first.
 *
 * **`onNext` throwing rejects the promise.** rxjs does not do that on its own:
 * an exception out of a `next` handler goes to its global unhandled-error hook,
 * so the subscriber keeps being fed and `complete` still fires — a bare promise
 * around that resolves as *success* with the items silently missing. Beside
 * `ObservableCreate` because it is the other half of the pattern: the adapter
 * wraps its body in that, the RPC `await`s this, so a per-item parse failure
 * surfaces as a track error instead of a blank-but-loaded track.
 *
 * The source is unsubscribed on the first throw.
 */
export function subscribeToObservable<T>(
  observable: Observable<T>,
  onNext: (item: T) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // A box rather than two bare `let`s: oxlint narrows a flag assigned only
    // inside a closure to its initializer and reports the reads as always-false.
    // `subscription` is genuinely still undefined during a synchronous source's
    // first emissions, which is why it is read optionally below.
    const state: { failed: boolean; subscription?: Subscription } = {
      failed: false,
    }
    state.subscription = observable.subscribe({
      next: item => {
        if (!state.failed) {
          try {
            onNext(item)
          } catch (e) {
            state.failed = true
            // A parser throws an Error in every real case here; the wrap is for
            // the rule that a rejection reason must be one, and keeps whatever
            // was actually thrown as the `cause`.
            reject(e instanceof Error ? e : new Error(String(e), { cause: e }))
            state.subscription?.unsubscribe()
          }
        }
      },
      error: reject,
      complete: () => {
        if (!state.failed) {
          resolve()
        }
      },
    })
  })
}
