import { isRegionRefused, measuredBytes } from '@jbrowse/core/rpc/byteBudget'
import { installFetch, runFetchOnce } from '@jbrowse/core/util/installFetch'
import { addDisposer } from '@jbrowse/mobx-state-tree'
import { untracked } from 'mobx'

import { fetchMixinLifecycle } from './FetchMixin.ts'
import { autorunOnReadyView } from './displayAutoruns.ts'
import { installClearHoverOnViewportChange } from './installClearHoverOnViewportChange.ts'

import type { FetchContext, FetchLifecycleHost } from './FetchMixin.ts'
import type { GateCommitHost, GateFetchState } from './regionTooLargeUtils.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { StopTokenRotation } from '@jbrowse/core/util/createStopTokenRotation'
import type { FetchPhases } from '@jbrowse/core/util/fetchPhases'
import type { FetchSkeletonHost } from '@jbrowse/core/util/installFetch'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * This family's spelling of the shared three-phase contract. The rules live on
 * {@link FetchPhases}; the comparative family names the same type over its own
 * context.
 *
 * `run` may answer the worker's refusal marker in place of a payload, which is
 * how the byte gate reaches this family: the RPC takes `resolvedByteLimit()`,
 * measures before it downloads, and the shared commit turns the marker into a
 * byte measurement and no display commit.
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

// `IStateTreeNode`, never `IAnyStateTreeNode` — the latter resolves through
// `STNValue<any, …>` to `any`, so extending it silently turns off checking for
// every member below, and a host missing one of them would compile. See the note
// on `FetchSelf` in canvas's fetchMultiRowFeatures.ts.
export interface GlobalFetchHost
  extends IStateTreeNode, FetchLifecycleHost, GateCommitHost {
  // `FetchMixin`'s, beside the begin/end/error trio `FetchLifecycleHost` above
  // names: the rotation this family lends the fetch skeleton, so `cancelFetch`
  // and `cancelFetchByUser` reach the fetch it installs rather than a second
  // rotation they cannot see.
  fetchRotation: StopTokenRotation
  // `GlobalFetchMixin`'s freshness pair: the resolved signature of what the
  // view and settings call for, captured at issue, and the commit that stamps
  // it in the same transaction as the display's own store. The signature, not
  // `dataCurrent`: that one also carries `dataSuperseded`, which holds the
  // export and must not refetch.
  fetchSignature: string | undefined
  commitFetchResult: (commit: () => void, signature: string) => void
}

export interface GlobalFetchAutorunHost
  extends GlobalFetchHost, FetchSkeletonHost {
  // `FetchMixin`'s: the durable user-cancel flag the viewport-change clear
  // reads (required here where the skeleton leaves it optional, since this
  // family has the Cancel button), and the internal reset that clear runs.
  fetchCanceled: boolean
  cancelFetch: () => void
  // `FetchMixin`'s, read only by the retry contract check the skeleton
  // installs: "a prerequisite fetch has not landed" defers the verdict.
  awaitingPrerequisite: boolean
  // The gate's own two, and neither is on the base above: an on-demand round
  // trip is the caller asking for a fetch, so only the installed trigger judges
  // whether one is owed. `RegionTooLargeMixin`'s combined skip is not listed as
  // its two terms — this helper reads only the combined one, and naming the
  // parts here would invite the expression back. A display that opts into no
  // byte gate reads `regionTooLarge` as a literal false, which makes it false
  // too.
  isMinimized: boolean
  gateSkipsMeasuredViewport: boolean
  // The committed side of the skeleton's freshness gate, and the verdict that
  // outranks it: while the banner holds, the stamp reads as absent, because the
  // banner is hiding that data and this fetch is the only re-measure.
  loadedFetchSignature: string | undefined
  regionTooLarge: boolean
  // The hosting view, for the not-yet-initialized gate: view-derived getters
  // (`dynamicBlocks`, `width`) throw before init by design, so the signature
  // must not be computed until this flips — and it is observable, so flipping
  // re-runs the body.
  host: { initialized: boolean }
  // The stored-hover clear's inputs — `regionTooLarge` above is the fourth axis
  // it watches, and `clearHoveredFeature` is
  // `BaseDisplay`'s no-op default a storer overrides. Installed here for the
  // reason the per-region foundation installs it: a display that forgets keeps
  // naming what used to be under the cursor.
  scrollTop?: number
  clearHoveredFeature: () => void
}

/** what one issued fetch was judged against, captured in `prepare` */
interface GlobalFetchIssue<TArgs> {
  args: TArgs
  signature: string
}

/** what one round trip landed, carrying the gate state it was issued under */
interface GlobalFetchLanding<TResult> {
  result: TResult | RegionTooLargeResult
  issued: GateFetchState
}

/**
 * The family's phases wrapped into the shared skeleton's shape: capture the
 * signature and the gate state at issue, measure-and-refuse or commit-and-stamp
 * at landing. One plan serves both entries — the installed autorun and the
 * on-demand {@link runGlobalFetchOnce} — so the commit rules cannot drift
 * between them.
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
      const signature = self.fetchSignature
      if (signature === undefined) {
        return undefined
      }
      const args = prepare()
      return args === undefined ? undefined : { args, signature }
    },
    run: async (issue, ctx) => {
      // Captured in `run`'s synchronous prefix — at issue, and untracked by the
      // skeleton's contract — so the measurement the result comes back with is
      // labelled with the viewport and the tier it was asked for, not a live
      // re-read at commit.
      const issued = self.gateFetchState()
      const result = await run(issue.args, ctx)
      return result === undefined ? undefined : { result, issued }
    },
    commit: ({ result, issued }, { args, signature }) => {
      self.commitFetchBytes([measuredBytes(result)], issued)
      if (!isRegionRefused(result)) {
        self.commitFetchResult(() => {
          commit(result, args)
        }, signature)
      }
    },
  }
}

/**
 * One fetch through the phases on demand: the same plan, rotation and lifecycle
 * the installed autorun runs, and **none of its gates** — a caller here is
 * asking for a round trip, not for the trigger's judgement about whether one is
 * owed. Returns the fetch's promise, or `undefined` for the one decline that is
 * the plan's rather than the skeleton's: no computable signature, or the
 * display's own `prepare` declining.
 *
 * The installed autorun is the production trigger; this is what a caller that
 * wants exactly one round trip and its promise drives — the per-display fetch
 * tests. It carried a copy of the family's gates until 2026-08-31, and that copy
 * is the drift the declaration over `installFetch` exists to close: it had no
 * reload override, no `initialized` term and no byte-gate skip, so the entry the
 * LD suite drove and the entry production runs disagreed about three of the four
 * gates while reading as the same thing. Gate behaviour belongs to
 * `installGlobalFetchAutorun.test.ts`, which drives the installed autorun.
 */
export function runGlobalFetchOnce<TArgs, TResult>(
  self: GlobalFetchHost,
  phases: GlobalFetchPhases<TArgs, TResult>,
) {
  const plan = globalFetchPlan(self, phases)
  const issue = plan.prepare()
  return issue === undefined
    ? undefined
    : runFetchOnce(self, self.fetchRotation.begin(), issue, {
        run: plan.run,
        commit: plan.commit,
        ...fetchMixinLifecycle(self),
      })
}

/**
 * Install the fetch for a `GlobalFetchMixin` display: the shared `installFetch`
 * skeleton — which owns the leading-edge debounce, the unconditional
 * `reloadCounter` read, the durable cancel gate, the freshness gate with its
 * reload override, and both contract checks — declared over this family's
 * signature machinery. A display supplies only its own `prepare` / `run` /
 * `commit`.
 *
 * What the declaration states, term by term:
 *
 * - **gate** — not initialized, minimized, or the byte-gate skip. The last one
 *   is not "don't fetch" but "don't fetch a viewport you have already
 *   measured": a blocked display still runs its fetch once per settled
 *   viewport, because the RPC's measurement is the only thing that releases the
 *   banner, and `gateSkipsMeasuredViewport` (whose own reads move with the
 *   viewport) is what keeps that to one. Each gate term is an observable that
 *   flips on the transition to wake on, which is what makes a gated decline
 *   safe — see ARCHITECTURE.md §"The global-fetch trigger list must be read
 *   unconditionally". Liveness is not a term here: `installFetch` checks it
 *   above every gate, because `host` is a parent walk and so is nearly every
 *   other gate in the tree.
 * - **fetchKey / committedKey** — `fetchSignature` (the display's
 *   `viewSignature` plus the serialized `rpcProps()` axis, so the viewport and
 *   every user setting are tracked wherever the compare runs) against the
 *   stamp `commitFetchResult` wrote. While `regionTooLarge` holds, the
 *   committed side reads as absent — the precedence the per-region family
 *   applies through `heldDataAnswers`, here spelled as a key: the banner is
 *   hiding that data and this fetch is the only re-measure. The
 *   skeleton's reload epoch is what makes Retry override this gate with
 *   nothing to clear — `GlobalFetchMixin.reload()` still drops the stamp so
 *   `dataCurrent` goes false and the overlay shows.
 * - **plan / lifecycle** — {@link globalFetchPlan}'s issue-time capture and
 *   measure-or-commit, over `FetchMixin`'s begin/end bookkeeping and the
 *   mixin's own rotation, so `cancelFetch` and the Cancel button reach the
 *   fetch this installs.
 *
 * `rpcProps()` loop hazard: unlike MultiRegion's `SettingsInvalidate` (which
 * clears data in a *separate, undelayed* autorun and so loops synchronously if
 * `rpcProps()` *returns* fetch-derived state — caught by `makeSettingsLoopGuard`),
 * this fetch reads the key and starts the round trip in the *same* debounced
 * body. A fetch-derived value in the payload here loops on the async-fetch
 * cadence (refetch → commit → key changes → reschedule after `delay` →
 * refetch), a slow network thrash rather than a synchronous freeze, so a
 * within-tick counter cannot distinguish it from legitimate rapid interaction.
 * The invariant is the same: `rpcProps()` must return only user-controlled
 * settings, never fetched data (see ARCHITECTURE.md §"rpcProps() loop trap").
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
    fetchKey: issue => issue.signature,
    committedKey: () =>
      self.regionTooLarge ? undefined : self.loadedFetchSignature,
    ...globalFetchPlan(self, opts),
    ...fetchMixinLifecycle(self),
  })

  // The other half of the durability rule, and the per-region family's twin
  // (`ClearBlockingStateOnViewportChange`): a cancel lapses when the user moves
  // the view, because the thing they stopped is no longer the thing they are
  // looking at. Undelayed, and the flag is read `untracked` so setting it
  // cannot fire this autorun and wipe it — only the viewport read may.
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

  // The per-region foundation's twin, so a global display that stores a hover
  // owes only the `clearHoveredFeature` override. Until 2026-08-27 only that
  // family installed it, and the one global display storing a hover
  // (`MultiWaySyntenyDisplay`) clicked through a zoom onto the gene that used
  // to be under the cursor.
  addDisposer(self, installClearHoverOnViewportChange(self))
}
