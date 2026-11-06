import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { installFetch } from '@jbrowse/core/util/installFetch'
import { isDataCurrent } from '@jbrowse/core/util/isDataCurrent'
import { addDisposer } from '@jbrowse/mobx-state-tree'
import { untracked } from 'mobx'

import { fetchMixinLifecycle } from './FetchMixin.ts'
import { autorunOnReadyView } from './displayAutoruns.ts'
import { measurementOf, openGateCommit } from './gateCommit.ts'
import { installClearHoverOnViewportChange } from './installClearHoverOnViewportChange.ts'
import { heldDataAnswers } from './regionTooLargeUtils.ts'

import type { FetchContext } from './FetchMixin.ts'
import type { FetchKey, KeyedFetchHost } from './KeyedFetchMixin.ts'
import type { GateCommit } from './gateCommit.ts'
import type { GateCommitHost } from './regionTooLargeUtils.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { FetchPhases } from '@jbrowse/core/util/fetchPhases'
import type { FetchSkeletonHost } from '@jbrowse/core/util/installFetch'

/**
 * This family's spelling of {@link FetchPhases}. `run` may answer the
 * worker's byte-gate refusal in place of a payload; the shared commit turns it
 * into a measurement and no display commit.
 */
export interface GlobalFetchPhases<TArgs, TResult> extends Omit<
  FetchPhases<TArgs, TResult, FetchContext>,
  'run'
> {
  run: (
    args: TArgs,
    ctx: FetchContext,
  ) => Promise<TResult | RegionTooLargeResult | undefined>
}

export interface GlobalFetchHost extends KeyedFetchHost, GateCommitHost {}

export interface GlobalFetchAutorunHost
  extends GlobalFetchHost, FetchSkeletonHost {
  // read by the viewport-change clear of a user cancel
  fetchCanceled: boolean
  cancelFetch: () => void
  awaitingPrerequisite: boolean
  isMinimized: boolean
  gateSkipsMeasuredViewport: boolean
  // while the banner holds, held data never answers: this fetch re-measures
  regionTooLarge: boolean
  // view-derived getters throw before init, so the gate waits on this
  host: { initialized: boolean }
  scrollTop?: number
  clearHoveredFeature: () => void
}

/** what one issued fetch was judged against, captured in `prepare` */
interface GlobalFetchIssue<TArgs> {
  args: TArgs
  signature: FetchKey
}

/** what one round trip landed, carrying the gate commit it was issued under */
interface GlobalFetchLanding<TResult> {
  result: TResult | RegionTooLargeResult
  gate: GateCommit
}

/**
 * The family's phases wrapped into the shared skeleton's shape: capture the
 * signature and the gate state at issue, measure-and-refuse or commit-and-stamp
 * at landing.
 */
function globalFetchPlan<TArgs, TResult>(
  self: GlobalFetchHost,
  { prepare, run, commit }: GlobalFetchPhases<TArgs, TResult>,
): FetchPhases<
  GlobalFetchIssue<TArgs>,
  GlobalFetchLanding<TResult>,
  FetchContext
> {
  return {
    prepare: () => {
      const signature = self.currentFetchKey
      if (signature === undefined) {
        return undefined
      }
      const args = prepare()
      return args === undefined ? undefined : { args, signature }
    },
    run: async (issue, ctx) => {
      // captured at issue, so the measurement is labelled with the viewport
      // and tier it was asked for
      const gate = openGateCommit(self)
      const result = await run(issue.args, ctx)
      return result === undefined ? undefined : { result, gate }
    },
    commit: ({ result, gate }, { args, signature }) => {
      gate.commit(measurementOf(result))
      if (!isRegionRefused(result)) {
        self.commitFetchResult(() => {
          commit(result, args)
        }, signature)
      }
    },
  }
}

/**
 * Install the fetch for a `GlobalFetchMixin` display on the shared
 * `installFetch` skeleton, which owns the debounce, the `reloadCounter` read,
 * the cancel gate, the freshness gate and the contract checks. A display
 * supplies `prepare`, `run` and `commit`.
 *
 * - **gate**: initialized, not minimized, and not a viewport the byte gate
 *   already measured. A blocked display still fetches once per settled
 *   viewport, since the RPC's measurement is what releases the banner.
 * - **heldAnswers**: `currentFetchKey` against the committed stamp, under
 *   `heldDataAnswers`, the same rule the per-region plan applies.
 *
 * `rpcProps()` must return only user-controlled settings, never fetched data:
 * here a fetch-derived value thrashes on the fetch cadence rather than
 * freezing, so no loop guard catches it (FETCH_KEYS.md, "rpcProps() loop
 * trap").
 */
export function installGlobalFetchAutorun<TArgs, TResult>(
  self: GlobalFetchAutorunHost,
  opts: GlobalFetchPhases<TArgs, TResult> & {
    delay: number
    name: string
  },
) {
  installFetch(self, {
    name: opts.name,
    delay: opts.delay,
    rotation: self.fetchRotation,
    contract: 'installGlobalFetchAutorun',
    gate: () =>
      self.host.initialized &&
      !self.isMinimized &&
      !self.gateSkipsMeasuredViewport,
    heldAnswers: issue =>
      heldDataAnswers(self.regionTooLarge, () =>
        isDataCurrent(self.loadedFetchKey, issue.signature),
      ),
    ...globalFetchPlan(self, opts),
    ...fetchMixinLifecycle(self),
  })

  // A user cancel lapses when the view moves. The flag is read untracked, or
  // setting it would fire this and wipe it.
  autorunOnReadyView(
    self,
    view => {
      void view.visibleRegions
      // eslint-disable-next-line no-restricted-syntax -- self-write: cancelFetch clears the flag this reads
      if (untracked(() => self.fetchCanceled)) {
        self.cancelFetch()
      }
    },
    { name: 'ClearCancelOnViewportChange' },
  )

  // Drop a stored hover when the content it names moves.
  addDisposer(self, installClearHoverOnViewportChange(self))
}
