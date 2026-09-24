import { installFetch } from './installFetch.ts'
import { isDataCurrent } from './isDataCurrent.ts'

import type { StatusReporter } from './createAbortRotation.ts'
import type { FetchContext } from './fetchContext.ts'
import type { FetchSkeletonHost } from './installFetch.ts'

/**
 * What a prerequisite read needs of the display it runs on, beside the
 * skeleton's own three. Duck-typed rather than a foundation's `Instance` type,
 * because the hosts compose different foundations — one per fetch family, and
 * the comparative displays compose none of them — and this is the only thing
 * they have in common.
 */
export interface PrerequisiteFetchHost extends FetchSkeletonHost {
  /**
   * Read in `prepare`, so it is **tracked**: an adapter edited in the config
   * editor has to re-read, and `run`'s own reads are untracked by contract.
   */
  adapterConfig: Record<string, unknown>
  isMinimized: boolean
}

/**
 * A prerequisite read's answer, stamped with the adapter config it answers.
 * A display holds the latest one and reads it through `readFor`, so an answer
 * never outlives its adapter config and no failure path has to clear it.
 */
export interface AdapterRead<T> {
  adapterConfig: Record<string, unknown>
  value: T
}

/**
 * `read`'s value while it answers the adapter config `host` holds; undefined
 * until a read of that config commits, which a failed read never does.
 *
 * Equal by value, as the fetch key is: an undo rebuilds the track's config,
 * handing back an equal adapter config the fetch declines to read again.
 */
export function readFor<T>(
  host: { adapterConfig: Record<string, unknown> },
  read: AdapterRead<T> | undefined,
): T | undefined {
  return read !== undefined &&
    isDataCurrent(read.adapterConfig, host.adapterConfig)
    ? read.value
    : undefined
}

/**
 * A **prerequisite read**: one RPC about the adapter itself, beside the
 * display's primary fetch. Three in the tree — HiC's `CoreGetInfo` header read,
 * whose `resolutions` every contacts fetch waits on; the multi-sample sample
 * list, which `fetchNeeded` declines until; and the tiered alignment file's
 * `CoreGetInfo` header, which decides the LOD tier a synteny fetch asks for —
 * and they sit on three different fetch foundations, which is why this sits in
 * core beside the skeleton and not beside any of them.
 *
 * They had the shape below hand-copied, comment for comment, and each term is a
 * rule rather than a preference:
 *
 * - **the adapter config is the whole trigger and the whole key.** Tracked in
 *   `prepare` so a config-editor edit re-reads; keyed on the same value so an
 *   un-minimize over the same file re-reads nothing. Getting one without the
 *   other gives either a stale header or a walk of a `.hic` norm-vector index on
 *   every expand.
 * - **the answer carries the same key** (`AdapterRead`), and a display reads
 *   it through `readFor`, so an answer to a previous adapter config is never
 *   read as the current one, and a failed read leaves nothing to clear.
 * - **minimized is the gate**, and a display with a second condition of its own
 *   passes `gate` — the sample-list read waits for the LGV to be measured as
 *   well, so a full-file scan does not start ahead of the display's own first
 *   fetch, and the tier read waits on the track declaring a tier threshold at
 *   all.
 * - **no `contract`.** This is the second fetch on a display whose foundation
 *   installed both checks already: `assertDisplayContract` would report the
 *   double-attach it exists to catch, and a second retry check would consume the
 *   same `reloadCounter` bumps as the first.
 * - **where the status goes is the caller's** (`report`). The two LGV reads
 *   lend the display's own status window, so the read takes a slot beside the
 *   primary fetch rather than opening a second writer over the one status field
 *   (ADR-081) — and it matters more here than for most fetches: a prerequisite
 *   runs inside the pre-first-paint window, where the scrim is up because
 *   nothing is drawn rather than because `isLoading` is, so `statusMessage` is
 *   the only thing that can say what is happening. The tier read narrates
 *   nothing; a header is not a load.
 *
 * `createAdapterMetadataFetch` keys on the same adapter config and is
 * deliberately NOT one of these: no trigger, no signal and no status,
 * because it is fetched lazily when a details widget opens and the widget opens
 * on the result. A prerequisite read is the one a display's own fetch waits on.
 *
 * **A declaration, not the skeleton this name used to be.** There was an
 * `installPrerequisiteFetch` until 2026-08-23, and `3c5aa7fce2` deleted it for
 * a good reason: it carried a `runOne` of its own — a fifth copy of begin →
 * clear → run → commit-if-current → `handleFetchError` → end — and once
 * `installFetch` owned that sequence, a second one was pure drift surface. This
 * one adds no sequence, no rotation and no error rule; it is terms handed to
 * `installFetch`, the same shape `installGlobalFetchAutorun` and
 * `installComparativeFetchAutorun` are. Add nothing here that a family could
 * not state as an option to the skeleton.
 *
 * Everything the skeleton gives it is the point of going through the skeleton:
 * the latest-wins rotation (so a superseding read aborts the one it replaced,
 * and only a superseding read does — a user cancel of the primary fetch cannot
 * strand the display the way sharing its signal would), the clear at the start,
 * the currency-guarded error rule, the unconditional `reloadCounter` read that
 * makes the chrome's Retry re-run this, and the retired status slot that keeps a
 * failed read from leaving a progress chip up for good.
 */
export function installPrerequisiteFetch<TResult>(
  self: PrerequisiteFetchHost,
  {
    name,
    delay,
    report,
    gate = () => true,
    run,
    commit,
    setError,
  }: {
    name: string
    delay: number
    report: StatusReporter
    /** an extra term of the display's own, ANDed under `!isMinimized` */
    gate?: () => boolean
    run: (
      adapterConfig: Record<string, unknown>,
      ctx: FetchContext,
    ) => Promise<TResult | undefined>
    commit: (read: AdapterRead<TResult>) => void
    setError: (error?: unknown) => void
  },
) {
  installFetch(self, {
    name,
    delay,
    report,
    gate: () => !self.isMinimized && gate(),
    prepare: () => ({ adapterConfig: self.adapterConfig }),
    fetchKey: ({ adapterConfig }) => adapterConfig,
    run: ({ adapterConfig }, ctx) => run(adapterConfig, ctx),
    commit: (value, { adapterConfig }) => {
      commit({ adapterConfig, value })
    },
    setError,
  })
}
