import { downloadStatus } from '../../util/progress.ts'

import type { BaseOptions } from './types.ts'

/** byte-granularity progress reporter to hand an index reader's `onProgress` */
type OnProgress = (current: number, total?: number) => void

/**
 * Memoize an adapter's one-time setup (open the file, read the header, build a
 * parser) into a loader every method can await.
 *
 * Two behaviors that every hand-rolled copy of this needs and that are easy to
 * get wrong:
 *
 * - a rejected setup clears the memo, so the next call retries instead of
 *   replaying the same rejection forever
 * - `label` is shown only while the *first* attempt is in flight. Re-entry on
 *   pan/zoom (every getFeatures and byte estimate awaits the loader) would
 *   otherwise re-flash "Downloading index" over an index that is already
 *   resident. Omit it for a setup whose progress is reported from the inside,
 *   e.g. a whole-file fetch that drives its own download bar — two labels for
 *   one download now, rather than the inner one blanking this, since phases
 *   nest (see `openPhase` in progress.ts).
 *
 * `setup` receives the opts of whichever call happened to run it first, so its
 * statusCallback/stopToken belong to that caller, plus an `onProgress` to pass
 * to an index reader so the label upgrades to a determinate bar.
 */
export function cachedSetup<T>({
  setup,
  label,
}: {
  setup: (opts?: BaseOptions, onProgress?: OnProgress) => Promise<T>
  label?: string
}) {
  let cached: Promise<T> | undefined
  let ready = false
  const run = (opts?: BaseOptions, onProgress?: OnProgress) => {
    cached ??= setup(opts, onProgress)
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
  return (opts?: BaseOptions) =>
    label === undefined || ready
      ? run(opts)
      : downloadStatus(label, opts?.statusCallback, onProgress =>
          run(opts, onProgress),
        )
}
