import type { Observable, Subscription } from 'rxjs'

/**
 * Subscribe to an observable and resolve when it completes, running `onNext`
 * per item as it arrives — the streaming shape every MAF adapter and RPC uses
 * to parse features without collecting them first.
 *
 * **`onNext` throwing rejects the promise.** rxjs does not do that on its own:
 * an exception out of a `next` handler goes to its global unhandled-error hook,
 * so the subscriber keeps being fed and `complete` still fires. Handing that
 * straight to a promise made every parse failure in this plugin invisible — the
 * six callers here are all per-feature parsers (`field5` splitting, byte
 * encoding, numeric coercion), and a throw in any of them resolved as success
 * with the features silently missing. That is the failure this plugin keeps
 * having to diagnose from a blank, fully-"loaded" track; the adapters wrap this
 * in `ObservableCreate` and the RPCs `await` it, so a rejection surfaces as a
 * track error instead.
 *
 * The source is unsubscribed on the first throw, so a large region stops
 * parsing rather than running to completion for a result nobody will read.
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
