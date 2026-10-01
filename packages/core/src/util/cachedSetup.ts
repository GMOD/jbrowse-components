import { checkAbortSignal, makeAbortError } from './aborting.ts'
import { downloadStatus } from './progress.ts'

import type { BaseOptions } from '../data_adapters/BaseAdapter/types.ts'
import type { StatusCallback } from './progress.ts'

/** byte-granularity progress reporter to hand an index reader's `onProgress` */
type OnProgress = (current: number, total?: number) => void

/**
 * How long a setup with no live waiter keeps running before its signal aborts:
 * `createAbortRotation.begin()` aborts the superseded call before it posts the
 * replacement, which joins within this window instead of restarting from byte 0.
 */
export const ABANDONED_SETUP_GRACE_MS = 100

/**
 * Memoize an adapter's one-time setup (open the file, read the header, build a
 * parser, download and parse a whole file) into a loader every method can
 * await.
 *
 * Four behaviors, each of which a hand-rolled `p ??= f().catch(...)` gets wrong
 * in a way that is invisible until it isn't:
 *
 * - **A rejected setup clears the memo**, so the next call retries instead of
 *   replaying the same rejection for the life of the adapter.
 * - **Progress fans out to every live waiter.** The setup body reports to
 *   whoever is *currently* awaiting it, not to whoever happened to start it. A
 *   memo that captured the first caller's `statusCallback` went silent the
 *   moment that fetch was superseded — the display's latest-wins guard gates the
 *   old callback off — so the fetch replacing it awaited a multi-GB parse behind
 *   a blank loading overlay.
 * - **Cancellation is shared, not per caller.** The setup gets one signal that
 *   aborts once its last live waiter has aborted and nobody rejoins within
 *   {@link ABANDONED_SETUP_GRACE_MS}, so a superseded fetch cannot cancel a
 *   parse its replacement is waiting on, yet a download nobody awaits stops.
 *   Each caller's own await rejects the moment its own signal aborts. An
 *   abandoned setup leaves the memo first, so the next call starts afresh and
 *   an abandoned run's late statuses reach no one.
 * - **`label` is shown only while the *first* attempt is in flight.** Re-entry
 *   on pan/zoom (every getFeatures and byte estimate awaits the loader) would
 *   otherwise re-flash "Downloading index" over an index that is already
 *   resident.
 *
 * Pass `label` when the setup is an index read that narrates nothing itself, so
 * the label is the whole story. Omit it when the setup reports from the inside —
 * a whole-file fetch driving its own download bar — since two labels for one
 * download is worse than one, and phases nest (see `openPhase` in progress.ts).
 * `onProgress` is for handing to an index reader that can upgrade the label to a
 * determinate bar.
 */
export function cachedSetup<T>({
  setup,
  label,
}: {
  setup: (opts: BaseOptions, onProgress?: OnProgress) => Promise<T>
  label?: string
}) {
  let flight: Flight<T> | undefined
  let resident: { value: T } | undefined

  const launch = (
    started: Flight<T>,
    opts: BaseOptions,
    onProgress?: OnProgress,
  ) =>
    setup(
      {
        ...opts,
        signal: started.controller.signal,
        statusCallback: status => {
          for (const cb of started.waiting.keys()) {
            cb(status)
          }
        },
      },
      onProgress,
    ).then(
      value => {
        clearTimeout(started.grace)
        if (flight === started) {
          resident = { value }
        }
        return value
      },
      (e: unknown) => {
        clearTimeout(started.grace)
        if (flight === started) {
          flight = undefined
        }
        throw e
      },
    )

  const abandon = (started: Flight<T>) => {
    if (flight === started) {
      flight = undefined
      started.controller.abort()
    }
  }

  const join = (opts: BaseOptions, onProgress?: OnProgress) => {
    const { signal, statusCallback } = opts
    const started: Flight<T> = (flight ??= {
      controller: new AbortController(),
      waiting: new Map(),
      live: 0,
    })
    clearTimeout(started.grace)
    started.live++
    if (statusCallback) {
      started.waiting.set(
        statusCallback,
        (started.waiting.get(statusCallback) ?? 0) + 1,
      )
    }
    const promise = (started.promise ??= launch(started, opts, onProgress))
    return new Promise<T>((resolve, reject) => {
      let joined = true
      const leave = () => {
        if (joined) {
          joined = false
          signal?.removeEventListener('abort', onAbort)
          started.live--
          if (statusCallback) {
            const count = started.waiting.get(statusCallback)! - 1
            if (count > 0) {
              started.waiting.set(statusCallback, count)
            } else {
              started.waiting.delete(statusCallback)
            }
          }
        }
      }
      const onAbort = () => {
        leave()
        reject(makeAbortError())
        if (started.live === 0) {
          started.grace = setTimeout(() => {
            abandon(started)
          }, ABANDONED_SETUP_GRACE_MS)
        }
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      promise.finally(leave).then(resolve, reject)
    })
  }

  return async (opts: BaseOptions = {}) => {
    if (resident) {
      return resident.value
    }
    checkAbortSignal(opts.signal)
    const wait = (onProgress?: OnProgress) => join(opts, onProgress)
    return label === undefined
      ? wait()
      : downloadStatus(label, opts.statusCallback, wait)
  }
}

interface Flight<T> {
  controller: AbortController
  waiting: Map<StatusCallback, number>
  live: number
  grace?: ReturnType<typeof setTimeout>
  promise?: Promise<T>
}

/**
 * {@link cachedSetup} taking a bare function instead of an options object.
 *
 * Kept because it is a published `@jbrowse/core/util` export and so pinned ABI
 * (see reference/PLUGIN_ABI_STABILITY.md); nothing in this repo calls it. It
 * used to be a second implementation, which is the thing worth not having: two
 * memos with the same shape and different answers about whose `statusCallback`
 * the shared work reports to, and no one place saying which to reach for.
 */
export function createSharedSetup<T>(run: (opts: BaseOptions) => Promise<T>) {
  return cachedSetup({ setup: run })
}
