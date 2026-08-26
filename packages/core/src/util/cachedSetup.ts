import { downloadStatus } from './progress.ts'

import type { BaseOptions } from '../data_adapters/BaseAdapter/types.ts'
import type { StatusCallback } from './progress.ts'

/** byte-granularity progress reporter to hand an index reader's `onProgress` */
type OnProgress = (current: number, total?: number) => void

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
 * - **`stopToken` is withheld from the shared work.** Honoring one caller's
 *   cancel would abort a parse the caller replacing it is already waiting on,
 *   and reject them both. A superseded fetch just stops listening. Cancellation
 *   stays with the per-call work (indexed range queries), which no one else is
 *   waiting on.
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
  const waiting = new Set<StatusCallback>()
  let cached: Promise<T> | undefined
  let ready = false

  const run = (opts: BaseOptions, onProgress?: OnProgress) => {
    cached ??= setup(
      {
        ...opts,
        stopToken: undefined,
        statusCallback: status => {
          for (const cb of waiting) {
            cb(status)
          }
        },
      },
      onProgress,
    )
      .then(result => {
        ready = true
        return result
      })
      .catch((e: unknown) => {
        cached = undefined
        throw e
      })
    return cached
  }

  return async (opts: BaseOptions = {}) => {
    const { statusCallback } = opts
    if (statusCallback) {
      waiting.add(statusCallback)
    }
    try {
      return await (label === undefined || ready
        ? run(opts)
        : downloadStatus(label, statusCallback, onProgress =>
            run(opts, onProgress),
          ))
    } finally {
      if (statusCallback) {
        waiting.delete(statusCallback)
      }
    }
  }
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
