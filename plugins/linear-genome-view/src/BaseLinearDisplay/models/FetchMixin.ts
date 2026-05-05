import { isAbortException } from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { flow, isAlive, types } from '@jbrowse/mobx-state-tree'

import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface FetchContext {
  stopToken: StopToken
  isStale: () => boolean
}

// Cancel-safe fetch lifecycle for any display that loads data over RPC.
//
// The mixin owns the entire fetch state machine (stop-token rotation,
// staleness tracking, error capture, status reporting). Consumers see
// only the high-level operations:
//
//   self.runFetch(work)   — start a cancellable fetch; cancels any prior.
//                           Implemented as an MST flow so post-await
//                           mutations stay inside the action context.
//   self.cancelFetch()       — cancel any in-flight fetch and bump
//                              fetchGeneration so observers re-evaluate.
//   self.isLoading           — true while a fetch is active.
//   self.error               — last non-abort error (or undefined).
//   self.statusMessage       — work-in-progress status string.
//   self.fetchGeneration     — see below.
//
// fetchGeneration bumps once at every fetch END (success, error, or cancel).
// Autoruns read `void self.fetchGeneration` to re-evaluate after a fetch completes;
// isLoading is not used as a dependency to avoid an extra fire on fetch start.
// The counter also serves as the staleness epoch in runFetch: captured at start,
// so a cancelFetch() bump makes isStale() return true in the in-flight flow.
//
// Composed by both per-region (MultiRegionDisplayMixin) and single-data
// (GlobalDataDisplayMixin) families.
export default function FetchMixin() {
  return types
    .model('FetchMixin', {})
    .volatile(() => ({
      activeStopToken: undefined as StopToken | undefined,
      fetchGeneration: 0,

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      error: undefined as unknown,

      statusMessage: undefined as string | undefined,
    }))
    .views(self => ({
      get isLoading() {
        return self.activeStopToken !== undefined
      },
    }))
    .actions(self => ({
      setError(error?: unknown) {
        self.error = error
      },
      setStatusMessage(msg?: string) {
        self.statusMessage = msg
      },
      // Cancel any in-flight fetch and bump fetchGeneration. Always bumps —
      // callers (clearAllRpcData, invalidateLoadedRegions) rely on the
      // bump to retrigger fetch autoruns even when no fetch was active.
      cancelFetch() {
        if (self.activeStopToken) {
          stopStopToken(self.activeStopToken)
          self.activeStopToken = undefined
          self.statusMessage = undefined
        }
        self.fetchGeneration++
      },
      // Run a cancel-safe fetch. Any in-flight fetch is cancelled first.
      // The work callback receives a FetchContext with a stopToken to
      // forward to the RPC and an isStale() check so it can short-circuit
      // commits when the user has moved on. Errors are caught (abort
      // exceptions silently, others stored in self.error if not stale).
      // The finally block clears the stop token and bumps fetchGeneration.
      runFetch: flow(function* (work: (ctx: FetchContext) => Promise<void>) {
        console.warn(`[FetchMixin] runFetch start (isLoading->true) t=${Date.now()}`)
        if (self.activeStopToken) {
          stopStopToken(self.activeStopToken)
        }
        const stopToken = createStopToken()
        const gen = self.fetchGeneration
        self.activeStopToken = stopToken
        self.error = undefined

        const isStale = () =>
          !isAlive(self) ||
          self.fetchGeneration !== gen ||
          self.activeStopToken !== stopToken

        try {
          yield work({ stopToken, isStale })
        } catch (e) {
          if (!isAbortException(e)) {
            console.error('Fetch failed:', e)
            if (!isStale()) {
              self.error = e
            }
          }
        } finally {
          if (!isStale()) {
            self.activeStopToken = undefined
            self.statusMessage = undefined
            self.fetchGeneration++
          }
        }
      }),
    }))
}

export type FetchMixinType = ReturnType<typeof FetchMixin>
