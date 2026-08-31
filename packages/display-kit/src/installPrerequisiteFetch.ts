import { installFetch } from '@jbrowse/core/util/installFetch'

import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { FetchSkeletonHost } from '@jbrowse/core/util/installFetch'
import type { StatusWindow } from '@jbrowse/core/util/progress'

/**
 * What a prerequisite read needs of the display it runs on, beside the
 * skeleton's own three. Duck-typed rather than a foundation's `Instance` type,
 * because the two hosts compose different foundations — one per fetch family —
 * and this is the only thing they have in common.
 */
export interface PrerequisiteFetchHost extends FetchSkeletonHost {
  /**
   * Read in `prepare`, so it is **tracked**: an adapter edited in the config
   * editor has to re-read, and `run`'s own reads are untracked by contract.
   */
  adapterConfig: Record<string, unknown>
  isMinimized: boolean
  /**
   * The display's own window, lent, so this read takes a slot beside the
   * display's primary fetch rather than opening a second writer over the one
   * status field (ADR-081).
   */
  statusWindow: StatusWindow
}

/**
 * A **prerequisite read**: one RPC about the adapter itself, beside the
 * display's primary fetch and gating it. Two in the tree — HiC's `CoreGetInfo`
 * header read, whose `resolutions` every contacts fetch waits on, and the
 * multi-sample sample list, which `fetchNeeded` declines until — and they are on
 * opposite fetch foundations, which is why this sits beside neither.
 *
 * They had the shape below hand-copied, comment for comment, and each term is a
 * rule rather than a preference:
 *
 * - **the adapter config is the whole trigger and the whole key.** Tracked in
 *   `prepare` so a config-editor edit re-reads; keyed on the same value so an
 *   un-minimize over the same file re-reads nothing. Getting one without the
 *   other gives either a stale header or a walk of a `.hic` norm-vector index on
 *   every expand.
 * - **minimized is the gate**, and a display with a second condition of its own
 *   passes `gate` — the sample-list read waits for the LGV to be measured as
 *   well, so a full-file scan does not start ahead of the display's own first
 *   fetch.
 * - **no `contract`.** This is the second fetch on a display whose foundation
 *   installed both checks already: `assertDisplayContract` would report the
 *   double-attach it exists to catch, and a second retry check would consume the
 *   same `reloadCounter` bumps as the first.
 * - **the status window is the display's, lent** — see
 *   {@link PrerequisiteFetchHost.statusWindow}. It matters more here than for
 *   most fetches: a prerequisite runs inside the pre-first-paint window, where
 *   the scrim is up because nothing is drawn rather than because `isLoading` is,
 *   so `statusMessage` is the only thing that can say what is happening.
 *
 * `createAdapterMetadataFetch` (core) keys on the same serialized adapter config
 * and is deliberately NOT one of these: no trigger, no stop token and no status,
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
 * strand the display the way sharing its token would), the clear at the start,
 * the currency-guarded error rule, the unconditional `reloadCounter` read that
 * makes the chrome's Retry re-run this, and the retired status slot that keeps a
 * failed read from leaving a progress chip up for good.
 */
export function installPrerequisiteFetch<TResult>(
  self: PrerequisiteFetchHost,
  {
    name,
    delay,
    gate = () => true,
    run,
    commit,
    setError,
  }: {
    name: string
    delay: number
    /** an extra term of the display's own, ANDed under `!isMinimized` */
    gate?: () => boolean
    run: (
      adapterConfig: Record<string, unknown>,
      ctx: FetchContext,
    ) => Promise<TResult | undefined>
    commit: (result: TResult) => void
    setError: (error?: unknown) => void
  },
) {
  installFetch(self, {
    name,
    delay,
    report: { statusWindow: self.statusWindow },
    gate: () => !self.isMinimized && gate(),
    prepare: () => ({ adapterConfig: self.adapterConfig }),
    fetchKey: ({ adapterConfig }) => JSON.stringify(adapterConfig),
    run: ({ adapterConfig }, ctx) => run(adapterConfig, ctx),
    commit,
    setError,
  })
}
